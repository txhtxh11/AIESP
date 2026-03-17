FROM node:20-bookworm

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir esphome

ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY . /app

WORKDIR /app/web-panel
RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
