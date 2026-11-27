FROM python:3.11-slim
RUN echo "double" && echo 'single'
ENV GREETING="say \"hi\""
ENV NOTE="it's fine"
RUN <<EOF
echo "heredoc line"
echo done
EOF
