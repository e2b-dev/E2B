package template_manager

type TemplateManager struct {
	grpc *GRPCClient
}

func New() (*TemplateManager, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}

	return &TemplateManager{
		grpc: client,
	}, nil
}

func (tm *TemplateManager) Close() error {
	return tm.grpc.Close()
}
