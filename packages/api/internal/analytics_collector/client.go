package analyticscollector

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"regexp"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

var (
	regex = regexp.MustCompile(`http[s]?://`)
	host  = regex.ReplaceAllString(os.Getenv("ANALYTICS_COLLECTOR_HOST"), "")
)

type ClientConnInterface interface {
	Invoke(ctx context.Context, method string, args any, reply any, opts ...grpc.CallOption) error
	NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error)
	Close() error
}

type Analytics struct {
	Client     AnalyticsCollectorClient
	connection ClientConnInterface
}

func getConnection() (ClientConnInterface, error) {
	if host == "" {
		fmt.Println("Analytics collector not set, using dummy connection")

		return &DummyConn{}, nil
	}

	if strings.HasPrefix(host, "localhost") {
		conn, err := grpc.Dial(host, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, fmt.Errorf("failed to dial: %w", err)
		}

		return conn, nil
	}

	systemRoots, err := x509.SystemCertPool()
	if err != nil {
		errMsg := fmt.Errorf("failed to read system root certificate pool: %w", err)

		return nil, errMsg
	}

	cred := credentials.NewTLS(&tls.Config{
		RootCAs:    systemRoots,
		MinVersion: tls.VersionTLS13,
	})

	conn, err := grpc.Dial(host+":443", grpc.WithAuthority(host), grpc.WithTransportCredentials(cred))

	if err != nil {
		return nil, fmt.Errorf("failed to dial: %w", err)
	}

	return conn, nil
}

func NewAnalytics() (*Analytics, error) {
	conn, err := getConnection()
	if err != nil {
		return nil, fmt.Errorf("failed to establish GRPC connection: %w", err)
	}

	client := NewAnalyticsCollectorClient(conn)

	return &Analytics{Client: client, connection: conn}, nil
}

func (a *Analytics) Close() error {
	err := a.connection.Close()
	if err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}

	return nil
}
