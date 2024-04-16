package writer

import (
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
)

type BuildLogsWriter struct {
	Done   chan struct{}
	stream template_manager.TemplateService_TemplateCreateServer
}

type LogsData struct {
	APISecret string   `json:"apiSecret"`
	Logs      []string `json:"logs"`
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
		Done:   make(chan struct{}),
		stream: stream,
	}

	return writer
}
