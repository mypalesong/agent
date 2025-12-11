---
sidebar_position: 1
title: "Kubernetes 배포"
description: "Kubernetes 기반 AgentOps 배포 가이드"
---

# Kubernetes 배포 가이드

AI 에이전트 시스템을 Kubernetes에 배포하기 위한 매니페스트와 설정을 제공합니다.

---

## 1. 배포 아키텍처

### 1.1 Kubernetes 구성

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AgentOps Kubernetes Architecture                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Namespace: agentops                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Ingress                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │  nginx-ingress / traefik / istio-gateway                     │ │ │
│  │  └────────────────────────────┬─────────────────────────────────┘ │ │
│  └────────────────────────────────┼───────────────────────────────────┘ │
│                                   │                                      │
│  ┌────────────────────────────────┼───────────────────────────────────┐ │
│  │                    Services    │                                    │ │
│  │  ┌─────────────┐ ┌─────────────▼─────────────┐ ┌─────────────┐    │ │
│  │  │  Control    │ │    Agent Runtime          │ │ Observability│   │ │
│  │  │   Plane     │ │      Service              │ │   Stack     │   │ │
│  │  │  Service    │ │                           │ │  Service    │   │ │
│  │  └──────┬──────┘ └─────────────┬─────────────┘ └──────┬──────┘   │ │
│  └─────────┼──────────────────────┼──────────────────────┼──────────┘ │
│            │                      │                      │            │
│  ┌─────────┼──────────────────────┼──────────────────────┼──────────┐ │
│  │         │    Deployments       │                      │          │ │
│  │  ┌──────▼──────┐ ┌─────────────▼─────────────┐ ┌──────▼──────┐  │ │
│  │  │  registry   │ │   agent-runtime (HPA)     │ │otel-collector│  │ │
│  │  │  config     │ │   ┌───┐ ┌───┐ ┌───┐       │ │  prometheus │  │ │
│  │  │  policy     │ │   │Pod│ │Pod│ │Pod│ ...   │ │   grafana   │  │ │
│  │  └─────────────┘ │   └───┘ └───┘ └───┘       │ └─────────────┘  │ │
│  │                  └───────────────────────────┘                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    StatefulSets / External                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │ │
│  │  │ PostgreSQL  │ │    Redis    │ │    NATS     │                │ │
│  │  │  (config)   │ │   (cache)   │ │   (A2A)     │                │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Namespace 및 기본 설정

### 2.1 Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agentops
  labels:
    app.kubernetes.io/name: agentops
    app.kubernetes.io/part-of: ai-platform
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: agentops-quota
  namespace: agentops
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    limits.cpu: "200"
    limits.memory: 400Gi
    persistentvolumeclaims: "20"
    pods: "200"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: agentops-limits
  namespace: agentops
spec:
  limits:
    - default:
        cpu: "2"
        memory: 4Gi
      defaultRequest:
        cpu: "500m"
        memory: 512Mi
      type: Container
```

### 2.2 ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentops-config
  namespace: agentops
data:
  # 환경 설정
  ENVIRONMENT: "production"
  LOG_LEVEL: "INFO"
  LOG_FORMAT: "json"

  # 서비스 엔드포인트
  REGISTRY_URL: "http://agent-registry:8080"
  CONFIG_SERVER_URL: "http://config-server:8080"
  POLICY_ENGINE_URL: "http://policy-engine:8080"

  # 메시지 버스
  NATS_URL: "nats://nats:4222"

  # 관찰 가능성
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
  PROMETHEUS_ENDPOINT: "http://prometheus:9090"

  # 캐시
  REDIS_URL: "redis://redis:6379"

  # 데이터베이스
  POSTGRES_HOST: "postgresql"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "agentops"
```

### 2.3 Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: agentops-secrets
  namespace: agentops
type: Opaque
stringData:
  # LLM API 키
  OPENAI_API_KEY: "${OPENAI_API_KEY}"
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"

  # 데이터베이스
  POSTGRES_USER: "agentops"
  POSTGRES_PASSWORD: "${DB_PASSWORD}"

  # JWT
  JWT_SECRET: "${JWT_SECRET}"

---
# External Secrets (권장)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: agentops-external-secrets
  namespace: agentops
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault-backend
  target:
    name: agentops-secrets
    creationPolicy: Owner
  data:
    - secretKey: OPENAI_API_KEY
      remoteRef:
        key: agentops/llm
        property: openai_api_key
    - secretKey: ANTHROPIC_API_KEY
      remoteRef:
        key: agentops/llm
        property: anthropic_api_key
```

---

## 3. Agent Runtime 배포

### 3.1 Deployment

```yaml
# agent-runtime-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-runtime
  namespace: agentops
  labels:
    app: agent-runtime
    component: data-plane
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-runtime
  template:
    metadata:
      labels:
        app: agent-runtime
        component: data-plane
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: agent-runtime-sa
      terminationGracePeriodSeconds: 60

      # 친화성 규칙
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: agent-runtime
                topologyKey: kubernetes.io/hostname

      containers:
        - name: agent-runtime
          image: ghcr.io/agentops/agent-runtime:v1.0.0
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 8080
            - name: metrics
              containerPort: 9090
            - name: grpc
              containerPort: 50051

          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP

          envFrom:
            - configMapRef:
                name: agentops-config
            - secretRef:
                name: agentops-secrets

          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2"
              memory: "4Gi"

          # 헬스 체크
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          startupProbe:
            httpGet:
              path: /health/startup
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30

          # 볼륨 마운트
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: agent-config
              mountPath: /etc/agent
              readOnly: true

          # 보안 컨텍스트
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL

      volumes:
        - name: tmp
          emptyDir: {}
        - name: agent-config
          configMap:
            name: agent-runtime-config

      # 토폴로지 분산
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: agent-runtime
```

### 3.2 Service

```yaml
# agent-runtime-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-runtime
  namespace: agentops
  labels:
    app: agent-runtime
spec:
  type: ClusterIP
  selector:
    app: agent-runtime
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: grpc
      port: 50051
      targetPort: 50051
    - name: metrics
      port: 9090
      targetPort: 9090
```

### 3.3 HorizontalPodAutoscaler

```yaml
# agent-runtime-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-runtime-hpa
  namespace: agentops
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-runtime
  minReplicas: 3
  maxReplicas: 50
  metrics:
    # CPU 기반
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # 메모리 기반
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # 커스텀 메트릭: 요청 큐 깊이
    - type: Pods
      pods:
        metric:
          name: agent_queue_depth
        target:
          type: AverageValue
          averageValue: "30"

    # 커스텀 메트릭: 활성 요청 수
    - type: Pods
      pods:
        metric:
          name: agent_active_requests
        target:
          type: AverageValue
          averageValue: "10"

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max

    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
      selectPolicy: Min
```

### 3.4 PodDisruptionBudget

```yaml
# agent-runtime-pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: agent-runtime-pdb
  namespace: agentops
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: agent-runtime
```

---

## 4. Observability Stack 배포

### 4.1 OpenTelemetry Collector

```yaml
# otel-collector.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: agentops
spec:
  replicas: 2
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.92.0
          args:
            - --config=/etc/otel/config.yaml
          ports:
            - containerPort: 4317  # OTLP gRPC
            - containerPort: 4318  # OTLP HTTP
            - containerPort: 8888  # Metrics
          resources:
            requests:
              cpu: "200m"
              memory: "400Mi"
            limits:
              cpu: "1"
              memory: "2Gi"
          volumeMounts:
            - name: config
              mountPath: /etc/otel
      volumes:
        - name: config
          configMap:
            name: otel-collector-config

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: agentops
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      batch:
        timeout: 5s
        send_batch_size: 512
      memory_limiter:
        check_interval: 1s
        limit_mib: 1500
        spike_limit_mib: 300

    exporters:
      jaeger:
        endpoint: jaeger:14250
        tls:
          insecure: true
      prometheus:
        endpoint: 0.0.0.0:8889

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [jaeger]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [prometheus]

---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: agentops
spec:
  selector:
    app: otel-collector
  ports:
    - name: otlp-grpc
      port: 4317
    - name: otlp-http
      port: 4318
    - name: metrics
      port: 8888
```

---

## 5. Ingress 설정

### 5.1 Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agentops-ingress
  namespace: agentops
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - agentops.example.com
        - api.agentops.example.com
      secretName: agentops-tls
  rules:
    - host: api.agentops.example.com
      http:
        paths:
          - path: /v1/agents
            pathType: Prefix
            backend:
              service:
                name: agent-runtime
                port:
                  number: 80
          - path: /v1/config
            pathType: Prefix
            backend:
              service:
                name: config-server
                port:
                  number: 80
    - host: agentops.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dashboard
                port:
                  number: 80
```

---

## 6. 다음 단계

- [CI/CD 파이프라인](./cicd) - 자동화된 배포
- [스케일링 전략](./scaling) - 오토스케일링 세부 설정
- [프로덕션 체크리스트](../best-practices/production-checklist) - 배포 전 확인
