start-template-server:
	docker run --rm -e E2B_LOCAL=true -p 49999:49999 -it $$(python build_docker.py | docker build -q . -f -)

kill-template-server:
	docker kill $(shell docker ps --filter expose=49999 --format {{.ID}})

debug-template:
	python build_debug.py && python debug_logs.py
