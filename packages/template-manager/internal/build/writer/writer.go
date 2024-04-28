package writer

import (
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
)

type BuildLogsWriter struct {
	stream template_manager.TemplateService_TemplateCreateServer
}

func (w BuildLogsWriter) Write(p []byte) (n int, err error) {
	err = w.stream.Send(&template_manager.TemplateBuildLog{Log: string(p)})
	if err != nil {
		return 0, err
	}

	return len(p), nil
}

func New(stream template_manager.TemplateService_TemplateCreateServer) BuildLogsWriter {
	writer := BuildLogsWriter{
		stream: stream,
	}

	return writer
}
