package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	log "golang.org/x/exp/slog"
	"google.golang.org/protobuf/proto"
	descriptor "google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/pluginpb"
)

const pluginVersion = "0.1.0.dev2"

func init() {
	ll := log.New(log.NewTextHandler(os.Stderr, &log.HandlerOptions{
		Level: log.LevelDebug,
		ReplaceAttr: func(groups []string, a log.Attr) log.Attr {
			if a.Key == log.TimeKey && len(groups) == 0 {
				return log.Attr{}
			}
			return a
		},
	}))
	log.SetDefault(ll.With(log.Int("pid", os.Getpid())))
}

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Fprintln(os.Stdout, pluginVersion)
		os.Exit(0)
	}

	f := func(plugin *Plugin) error {
		for _, f := range plugin.filesToGenerate {
			generate(plugin, f)
		}
		return nil
	}
	if err := run(f); err != nil {
		fmt.Fprintf(os.Stderr, "%s: %v\n", filepath.Base(os.Args[0]), err)
		os.Exit(1)
	}
}

func run(f func(*Plugin) error) error {
	in, err := io.ReadAll(os.Stdin)
	if err != nil {
		return err
	}
	req := &pluginpb.CodeGeneratorRequest{}
	if err := proto.Unmarshal(in, req); err != nil {
		return err
	}
	gen, err := newPlugin(req)
	if err != nil {
		return err
	}
	if err := f(gen); err != nil {
		gen.Error(err)
	}
	resp := gen.Response()
	out, err := proto.Marshal(resp)
	if err != nil {
		return err
	}
	_, err = os.Stdout.Write(out)
	return err
}

func newPlugin(req *pluginpb.CodeGeneratorRequest) (*Plugin, error) {
	gen := &Plugin{
		request:        req,
		filesByPackage: make(map[string]*descriptor.FileDescriptorProto),
		filesByPath:    make(map[string]*descriptor.FileDescriptorProto),
		messagesByType: make(map[string]*descriptor.DescriptorProto),
	}

	for _, f := range gen.request.ProtoFile {
		name := f.GetName()

		pkg := f.GetPackage()
		log.Debug("ProtoFile",
			log.String("name", name),
			log.String("pkg", pkg),
		)
		// if _, ok := gen.filesByPackage[pkg]; ok {
		// 	return nil, fmt.Errorf("duplicate package: %q", name)
		// }
		gen.filesByPackage[pkg] = f
		if _, ok := gen.filesByPath[name]; ok {
			return nil, fmt.Errorf("duplicate file name: %q", name)
		}
		gen.filesByPath[name] = f
		for _, msg := range f.GetMessageType() {
			msgKey := f.GetPackage() + "." + msg.GetName()
			if _, ok := gen.messagesByType[msgKey]; ok {
				return nil, fmt.Errorf("duplicate message: %q", msgKey)
			}
			gen.messagesByType[msgKey] = msg
			log.Debug("MessageType",
				log.String("name", msgKey),
			)
		}
		gen.files = append(gen.files, f)
	}

	for _, name := range req.FileToGenerate {
		if f, ok := gen.filesByPath[name]; ok {
			log.Debug("FileToGenerate",
				log.String("name", name),
				log.Any("deps", f.Dependency),
				log.Int("services", len(f.Service)),
			)
			if len(f.Service) > 0 {
				gen.filesToGenerate = append(gen.filesToGenerate, f)
			}
		} else {
			return nil, fmt.Errorf("missing file: %q", name)
		}
	}

	return gen, nil
}

type Plugin struct {
	request *pluginpb.CodeGeneratorRequest

	files           []*descriptor.FileDescriptorProto
	filesByPackage  map[string]*descriptor.FileDescriptorProto
	filesByPath     map[string]*descriptor.FileDescriptorProto
	messagesByType  map[string]*descriptor.DescriptorProto
	filesToGenerate []*descriptor.FileDescriptorProto

	generatedFiles []*pluginpb.CodeGeneratorResponse_File

	err error
}

func (gen *Plugin) Response() *pluginpb.CodeGeneratorResponse {
	resp := &pluginpb.CodeGeneratorResponse{}
	if gen.err != nil {
		resp.Error = Ptr(gen.err.Error())
		return resp
	}
	resp.File = gen.generatedFiles
	return resp
}

func (gen *Plugin) Error(err error) {
	if gen.err == nil {
		gen.err = err
	}
}

func Ptr[T any](v T) *T {
	return &v
}

func print(buf *strings.Builder, tpl string, args ...interface{}) {
	buf.WriteString(fmt.Sprintf(tpl, args...))
	buf.WriteByte('\n')
}

func getPackage(path string) string {
	return strings.ReplaceAll(filepath.Dir(path), "/", ".")
}

func getModule(path string) string {
	path = filepath.Base(path)
	ext := filepath.Ext(path)
	return strings.TrimSuffix(path, ext)
}

func getProtoModule(path string) string {
	return getModule(path) + "_pb2"
}

func getConnectModule(path string) string {
	return getModule(path) + "_connect"
}

func getProtoModuleAlias(path string) string {
	path = getPackage(path) + "." + getProtoModule(path)
	path = strings.ReplaceAll(path, "_", "__")
	path = strings.ReplaceAll(path, ".", "_dot_")
	return path
}

func getServiceName(svc *descriptor.ServiceDescriptorProto) string {
	return svc.GetName() + "Name"
}

func getServiceClient(svc *descriptor.ServiceDescriptorProto) string {
	return svc.GetName() + "Client"
}

func getServiceBasePath(file *descriptor.FileDescriptorProto, svc *descriptor.ServiceDescriptorProto) string {
	return file.GetPackage() + "." + svc.GetName()
}

func getMethodProperty(m *descriptor.MethodDescriptorProto) string {
	return "_" + toSnakeCase(m.GetName())
}

func getMethodType(m *descriptor.MethodDescriptorProto) string {
	switch {
	case m.GetClientStreaming() && m.GetServerStreaming():
		return "bidi_stream"
	case m.GetClientStreaming():
		return "client_stream"
	case m.GetServerStreaming():
		return "server_stream"
	default:
		return "unary"
	}
}

func splitPackageType(path string) (string, string) {
	lastDot := strings.LastIndexByte(path, '.')
	return path[:lastDot], path[lastDot+1:]
}

func resolveMessageFromMethod(gen *Plugin, m *descriptor.MethodDescriptorProto) (string, string) {
	fullyQualifiedName := m.GetOutputType()[1:] // strip prefixed "."
	pkgName, msgName := splitPackageType(fullyQualifiedName)
	filename := gen.filesByPackage[pkgName].GetName()
	return filename, msgName
}

func resolveInputFromMethod(gen *Plugin, m *descriptor.MethodDescriptorProto) (string, string) {
	fullyQualifiedName := m.GetInputType()[1:] // strip prefixed "."
	pkgName, msgName := splitPackageType(fullyQualifiedName)
	filename := gen.filesByPackage[pkgName].GetName()
	return filename, msgName
}

func getResponseType(gen *Plugin, m *descriptor.MethodDescriptorProto) string {
	filename, msgName := resolveMessageFromMethod(gen, m)

	log.Debug("ResponseType",
		log.String("msg", msgName),
		log.String("import", filename),
		log.String("alias", getProtoModuleAlias(filename)),
	)
	return getProtoModuleAlias(filename) + "." + msgName
}

func getRequestType(gen *Plugin, m *descriptor.MethodDescriptorProto) string {
	filename, msgName := resolveInputFromMethod(gen, m)

	log.Debug("RequestType",
		log.String("msg", msgName),
		log.String("import", filename),
		log.String("alias", getProtoModuleAlias(filename)),
	)
	return getProtoModuleAlias(filename) + "." + msgName
}

var (
	matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
	matchAllCap   = regexp.MustCompile("([a-z0-9])([A-Z])")
)

func toSnakeCase(str string) string {
	snake := matchFirstCap.ReplaceAllString(str, "${1}_${2}")
	snake = matchAllCap.ReplaceAllString(snake, "${1}_${2}")
	return strings.ToLower(snake)
}

func generate(gen *Plugin, file *descriptor.FileDescriptorProto) {
	filename := file.GetName()

	dir := filepath.Dir(filename)
	pkgName := getPackage(filename)
	modName := getModule(filename)

	log.Debug("Generate",
		log.String("name", filename),
		log.String("pkg", pkgName),
		log.String("mod", modName),
	)

	b := new(strings.Builder)

	depsUniq := make(map[string]struct{})
	for _, svc := range file.Service {
		for _, method := range svc.Method {
			filename, _ := resolveMessageFromMethod(gen, method)
			depsUniq[filename] = struct{}{}
		}
	}

	deps := make([]string, 0, len(depsUniq))
	for dep := range depsUniq {
		deps = append(deps, dep)
	}
	sort.Strings(deps)

	print(b, "# Code generated by protoc-gen-connect-python %s, DO NOT EDIT.", pluginVersion)

	print(b, "from typing import Any, Generator, Coroutine, AsyncGenerator, Optional")
	print(b, "from httpcore import ConnectionPool, AsyncConnectionPool")
	print(b, "")

	print(b, "import e2b_connect as connect")
	if len(deps) > 0 {
		print(b, "")
		for _, dep := range deps {
			print(b, "from %s import %s as %s", getPackage(dep), getProtoModule(dep), getProtoModuleAlias(dep))
		}
	}
	print(b, "")

	for _, svc := range file.Service {
		print(b, `%s = "%s"`, getServiceName(svc), getServiceBasePath(file, svc))
	}

	for _, svc := range file.Service {
		print(b, "")
		print(b, "")
		print(b, `class %s:`, getServiceClient(svc))
		print(b, "    def __init__(self, base_url: str, *, pool: Optional[ConnectionPool] = None, async_pool: Optional[AsyncConnectionPool] = None, compressor=None, json=False, **opts):")
		if len(svc.Method) == 0 {
			print(b, "        pass")
			continue
		}
		for _, method := range svc.Method {
			print(b, "        self.%s = connect.Client(", getMethodProperty(method))
			print(b, "            pool=pool,")
			print(b, "            async_pool=async_pool,")
			print(b, `            url=f"{base_url}/{%s}/%s",`, getServiceName(svc), method.GetName())
			print(b, `            response_type=%s,`, getResponseType(gen, method))
			print(b, `            compressor=compressor,`)
			print(b, `            json=json,`)
			print(b, `            **opts`)
			print(b, "        )")
		}
		for _, method := range svc.Method {
			print(b, "")

			if method.GetServerStreaming() {
				print(b, "    def %s(self, req: %s , **opts) -> Generator[%s, Any, None]:", toSnakeCase(method.GetName()), getRequestType(gen, method), getResponseType(gen, method))
				print(b, "        return self.%s.call_%s(req, **opts)", getMethodProperty(method), getMethodType(method))
				print(b, "")
				print(b, "    def a%s(self, req: %s , **opts) -> AsyncGenerator[%s, Any]:", toSnakeCase(method.GetName()), getRequestType(gen, method), getResponseType(gen, method))
				print(b, "        return self.%s.acall_%s(req, **opts)", getMethodProperty(method), getMethodType(method))
			} else {
				print(b, "    def %s(self, req: %s, **opts) -> %s:", toSnakeCase(method.GetName()), getRequestType(gen, method), getResponseType(gen, method))
				print(b, "        return self.%s.call_%s(req, **opts)", getMethodProperty(method), getMethodType(method))
				print(b, "")
				print(b, "    def a%s(self, req: %s, **opts) -> Coroutine[Any, Any, %s]:", toSnakeCase(method.GetName()), getRequestType(gen, method), getResponseType(gen, method))
				print(b, "        return self.%s.acall_%s(req, **opts)", getMethodProperty(method), getMethodType(method))
			}
		}
	}

	gen.generatedFiles = append(gen.generatedFiles, &pluginpb.CodeGeneratorResponse_File{
		Name:    Ptr(filepath.Join(dir, getConnectModule(filename)+".py")),
		Content: Ptr(b.String()),
	})
}
