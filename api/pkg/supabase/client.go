package supabase

import (
  "fmt"
  "os"
  "net/url"
  postgrest "github.com/nedpals/postgrest-go/pkg"
)

type Client struct {
  DB *postgrest.Client
}

func NewClient() (*Client, error) {
  skey := os.Getenv("SUPABASE_KEY")
  surl := os.Getenv("SUPABASE_URL")
  parsedURL, err := url.Parse(surl)
  if err != nil {
    return nil, fmt.Errorf("Failed to parse Supabase URL '%s': %s", surl, err)
  }

  pclient := postgrest.NewClient(
    *parsedURL,
    postgrest.WithTokenAuth(skey),
    func(c *postgrest.Client) {
      //c.Debug = true
      c.AddHeader("apikey", skey)
    },
  )

  return &Client{
    DB: pclient,
  }, nil
}
