build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/devbookd .

build-darwin:
	GOOS=darwin go build -o bin/devbookd-darwing .

testenv:
	make build
	docker build -t devbookd-testenv . -f testenv.Dockerfile
