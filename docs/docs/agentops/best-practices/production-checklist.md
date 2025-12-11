---
sidebar_position: 2
title: "프로덕션 체크리스트"
description: "AI 에이전트 프로덕션 배포 전 점검 사항"
---

# 프로덕션 체크리스트

AI 에이전트 시스템을 프로덕션 환경에 배포하기 전 확인해야 할 모든 항목을 정리합니다.

---

## 1. 체크리스트 개요

### 1.1 프로덕션 준비도 레벨

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Production Readiness Levels                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Level 0: Development (개발)                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━                                              │
│  • 기본 기능 동작                                                        │
│  • 로컬 테스트 통과                                                      │
│                                                                          │
│  Level 1: Staging (스테이징)                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                            │
│  • 통합 테스트 통과                                                      │
│  • 기본 모니터링 설정                                                    │
│  • CI/CD 파이프라인 구축                                                 │
│                                                                          │
│  Level 2: Pre-Production (프리프로덕션)                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                   │
│  • 부하 테스트 완료                                                      │
│  • 보안 감사 통과                                                        │
│  • 장애 복구 테스트                                                      │
│  • 문서화 완료                                                           │
│                                                                          │
│  Level 3: Production Ready (프로덕션 준비)                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                │
│  • 모든 체크리스트 항목 완료                                             │
│  • 런북 작성                                                             │
│  • 온콜 체계 구축                                                        │
│  • 롤백 계획 수립                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 및 품질

### 2.1 에이전트 품질 검증

```yaml
# checklist/agent-quality.yaml

agent_quality:
  functional:
    - id: AQ-001
      name: "Task Completion Rate"
      description: "에이전트 작업 완료율"
      threshold: ">= 85%"
      verification: |
        python -m agentops.eval.runner \
          --test-suite tests/eval/production_suite.yaml \
          --metric task_completion
      required: true

    - id: AQ-002
      name: "Response Quality Score"
      description: "응답 품질 점수"
      threshold: ">= 80%"
      verification: |
        python -m agentops.eval.runner \
          --test-suite tests/eval/quality_suite.yaml \
          --metric response_quality
      required: true

    - id: AQ-003
      name: "Edge Case Handling"
      description: "엣지 케이스 처리 능력"
      threshold: ">= 75%"
      verification: |
        python -m agentops.eval.runner \
          --test-suite tests/eval/edge_cases.yaml
      required: true

  safety:
    - id: AQ-004
      name: "Safety Score"
      description: "안전성 점수"
      threshold: ">= 95%"
      verification: |
        python -m agentops.eval.safety \
          --test-suite tests/eval/safety_suite.yaml
      required: true

    - id: AQ-005
      name: "PII Handling"
      description: "개인정보 처리 검증"
      threshold: "100% (no leakage)"
      verification: |
        python -m agentops.security.pii_test \
          --test-cases tests/security/pii_cases.yaml
      required: true

    - id: AQ-006
      name: "Prompt Injection Resistance"
      description: "프롬프트 인젝션 방어"
      threshold: ">= 98%"
      verification: |
        python -m agentops.security.injection_test \
          --test-cases tests/security/injection_cases.yaml
      required: true

  performance:
    - id: AQ-007
      name: "Response Latency P95"
      description: "응답 지연시간 95백분위"
      threshold: "<= 10s"
      verification: |
        python -m agentops.perf.latency_test \
          --percentile 95
      required: true

    - id: AQ-008
      name: "Throughput"
      description: "처리량"
      threshold: ">= 100 req/s"
      verification: |
        python -m agentops.perf.throughput_test
      required: false
```

### 2.2 테스트 커버리지

```yaml
# checklist/testing.yaml

testing:
  unit_tests:
    - id: T-001
      name: "Unit Test Coverage"
      description: "단위 테스트 커버리지"
      threshold: ">= 80%"
      command: "pytest --cov=src --cov-report=term --cov-fail-under=80"
      required: true

    - id: T-002
      name: "Critical Path Coverage"
      description: "핵심 경로 100% 커버리지"
      threshold: "100%"
      paths:
        - "src/agents/core.py"
        - "src/guardrails/"
        - "src/security/"
      required: true

  integration_tests:
    - id: T-003
      name: "API Integration Tests"
      description: "API 통합 테스트"
      command: "pytest tests/integration/api/"
      required: true

    - id: T-004
      name: "LLM Provider Integration"
      description: "LLM 프로바이더 통합 테스트"
      command: "pytest tests/integration/llm/"
      required: true

    - id: T-005
      name: "Database Integration"
      description: "데이터베이스 통합 테스트"
      command: "pytest tests/integration/db/"
      required: true

  e2e_tests:
    - id: T-006
      name: "End-to-End Scenarios"
      description: "E2E 시나리오 테스트"
      command: "pytest tests/e2e/"
      required: true

    - id: T-007
      name: "User Journey Tests"
      description: "사용자 여정 테스트"
      scenarios:
        - "new_user_onboarding"
        - "returning_user_task"
        - "error_recovery"
      required: true

  load_tests:
    - id: T-008
      name: "Load Test - Normal"
      description: "정상 부하 테스트"
      config:
        users: 100
        duration: "10m"
        ramp_up: "2m"
      thresholds:
        error_rate: "< 1%"
        p95_latency: "< 5s"
      required: true

    - id: T-009
      name: "Load Test - Peak"
      description: "피크 부하 테스트"
      config:
        users: 500
        duration: "30m"
        ramp_up: "5m"
      thresholds:
        error_rate: "< 5%"
        p95_latency: "< 15s"
      required: true

    - id: T-010
      name: "Stress Test"
      description: "스트레스 테스트"
      config:
        users: 1000
        duration: "15m"
      verify:
        - "System recovers after load reduction"
        - "No data corruption"
      required: false
```

---

## 3. 인프라 및 배포

### 3.1 Kubernetes 설정

```yaml
# checklist/infrastructure.yaml

kubernetes:
  deployment:
    - id: K-001
      name: "Resource Limits"
      description: "모든 컨테이너에 리소스 제한 설정"
      verification: |
        kubectl get pods -n agentops -o jsonpath='{range .items[*]}{.spec.containers[*].resources}{"\n"}{end}'
      required: true

    - id: K-002
      name: "Liveness/Readiness Probes"
      description: "헬스체크 프로브 설정"
      verification: |
        kubectl get deploy -n agentops -o jsonpath='{.items[*].spec.template.spec.containers[*].livenessProbe}'
      required: true

    - id: K-003
      name: "Pod Disruption Budget"
      description: "PDB 설정으로 가용성 보장"
      verification: |
        kubectl get pdb -n agentops
      min_available: "50%"
      required: true

    - id: K-004
      name: "Anti-Affinity Rules"
      description: "파드 분산 배치"
      verification: |
        kubectl get deploy -n agentops -o yaml | grep -A5 podAntiAffinity
      required: true

    - id: K-005
      name: "Horizontal Pod Autoscaler"
      description: "HPA 설정"
      verification: |
        kubectl get hpa -n agentops
      required: true

  networking:
    - id: K-006
      name: "Network Policies"
      description: "네트워크 정책 설정"
      verification: |
        kubectl get networkpolicy -n agentops
      required: true

    - id: K-007
      name: "Ingress TLS"
      description: "Ingress TLS 설정"
      verification: |
        kubectl get ingress -n agentops -o jsonpath='{.items[*].spec.tls}'
      required: true

    - id: K-008
      name: "Service Mesh (Optional)"
      description: "서비스 메시 설정"
      required: false

  storage:
    - id: K-009
      name: "Persistent Volume Claims"
      description: "PVC 상태 확인"
      verification: |
        kubectl get pvc -n agentops -o jsonpath='{.items[*].status.phase}'
      expected: "Bound"
      required: true

    - id: K-010
      name: "Backup Configuration"
      description: "백업 설정"
      components:
        - "Database"
        - "Configuration"
        - "Secrets"
      required: true
```

### 3.2 CI/CD 파이프라인

```yaml
# checklist/cicd.yaml

cicd:
  pipeline:
    - id: CI-001
      name: "Automated Build"
      description: "자동화된 빌드 프로세스"
      stages:
        - lint
        - type_check
        - security_scan
        - build
      required: true

    - id: CI-002
      name: "Automated Testing"
      description: "자동화된 테스트"
      stages:
        - unit_tests
        - integration_tests
        - agent_evaluation
      required: true

    - id: CI-003
      name: "Quality Gates"
      description: "품질 게이트 설정"
      gates:
        - name: "Test Coverage"
          threshold: ">= 80%"
        - name: "Task Completion"
          threshold: ">= 85%"
        - name: "Safety Score"
          threshold: ">= 95%"
      required: true

    - id: CI-004
      name: "Container Scanning"
      description: "컨테이너 취약점 스캔"
      tools:
        - "Trivy"
        - "Snyk"
      threshold: "No critical/high vulnerabilities"
      required: true

  deployment:
    - id: CI-005
      name: "Canary Deployment"
      description: "카나리 배포 전략"
      config:
        initial_percentage: 10
        increment: 20
        interval: "5m"
      required: true

    - id: CI-006
      name: "Rollback Automation"
      description: "자동 롤백 설정"
      triggers:
        - "Error rate > 5%"
        - "Latency P95 > 15s"
        - "Health check failures"
      required: true

    - id: CI-007
      name: "Environment Parity"
      description: "환경 일관성"
      environments:
        - staging
        - production
      verification: "Config diff < 5%"
      required: true
```

---

## 4. 보안

### 4.1 보안 체크리스트

```yaml
# checklist/security.yaml

security:
  authentication:
    - id: S-001
      name: "API Authentication"
      description: "API 인증 설정"
      methods:
        - "API Keys"
        - "JWT"
        - "OAuth 2.0"
      required: true

    - id: S-002
      name: "Secret Management"
      description: "시크릿 관리"
      requirements:
        - "No secrets in code"
        - "Secrets in vault/KMS"
        - "Secret rotation enabled"
      verification: |
        git secrets --scan
        kubectl get secrets -n agentops -o yaml | grep -v "^data:"
      required: true

    - id: S-003
      name: "Service Account Security"
      description: "서비스 계정 보안"
      requirements:
        - "Least privilege principle"
        - "No default service accounts"
      required: true

  data_protection:
    - id: S-004
      name: "Data Encryption at Rest"
      description: "저장 데이터 암호화"
      components:
        - "Database (AES-256)"
        - "Object Storage (SSE)"
        - "Backups"
      required: true

    - id: S-005
      name: "Data Encryption in Transit"
      description: "전송 데이터 암호화"
      requirements:
        - "TLS 1.3"
        - "Certificate management"
      required: true

    - id: S-006
      name: "PII Protection"
      description: "개인정보 보호"
      measures:
        - "PII detection"
        - "Data masking"
        - "Access logging"
      required: true

  guardrails:
    - id: S-007
      name: "Input Guardrails"
      description: "입력 가드레일"
      checks:
        - "Prompt injection detection"
        - "PII detection"
        - "Content moderation"
      required: true

    - id: S-008
      name: "Output Guardrails"
      description: "출력 가드레일"
      checks:
        - "PII masking"
        - "Harmful content filter"
        - "Hallucination detection"
      required: true

    - id: S-009
      name: "Rate Limiting"
      description: "요청 제한"
      config:
        per_user: "100 req/min"
        per_ip: "200 req/min"
        global: "10000 req/min"
      required: true

  compliance:
    - id: S-010
      name: "Audit Logging"
      description: "감사 로깅"
      events:
        - "Authentication"
        - "Data access"
        - "Configuration changes"
        - "Guardrail triggers"
      retention: "7 years"
      required: true

    - id: S-011
      name: "GDPR Compliance"
      description: "GDPR 준수"
      requirements:
        - "Data subject rights implementation"
        - "Consent management"
        - "Data processing records"
      required: conditional  # EU 사용자가 있는 경우

    - id: S-012
      name: "AI Transparency"
      description: "AI 투명성"
      requirements:
        - "AI disclosure to users"
        - "Decision explainability"
      required: true
```

---

## 5. 관찰 가능성

### 5.1 모니터링 설정

```yaml
# checklist/observability.yaml

observability:
  metrics:
    - id: O-001
      name: "Application Metrics"
      description: "애플리케이션 메트릭 수집"
      metrics:
        - "agent_requests_total"
        - "agent_request_duration_seconds"
        - "agent_errors_total"
        - "agent_llm_tokens_total"
        - "agent_task_completion_rate"
      required: true

    - id: O-002
      name: "Infrastructure Metrics"
      description: "인프라 메트릭 수집"
      metrics:
        - "CPU/Memory usage"
        - "Network I/O"
        - "Disk usage"
      required: true

    - id: O-003
      name: "Business Metrics"
      description: "비즈니스 메트릭"
      metrics:
        - "Active users"
        - "Task success rate"
        - "User satisfaction"
      required: true

  logging:
    - id: O-004
      name: "Structured Logging"
      description: "구조화된 로깅"
      format: "JSON"
      fields:
        - "timestamp"
        - "level"
        - "trace_id"
        - "request_id"
        - "message"
      required: true

    - id: O-005
      name: "Log Aggregation"
      description: "로그 집계"
      system: "Loki/Elasticsearch"
      retention: "30 days"
      required: true

    - id: O-006
      name: "Log Levels"
      description: "로그 레벨 설정"
      production_level: "INFO"
      sensitive_data: "Masked"
      required: true

  tracing:
    - id: O-007
      name: "Distributed Tracing"
      description: "분산 추적"
      system: "OpenTelemetry + Jaeger/Tempo"
      sampling_rate: "10%"
      required: true

    - id: O-008
      name: "Agent-Specific Spans"
      description: "에이전트 전용 스팬"
      spans:
        - "agent.request"
        - "agent.llm_call"
        - "agent.tool_call"
        - "agent.guardrail"
      required: true

  alerting:
    - id: O-009
      name: "Critical Alerts"
      description: "중요 알림 설정"
      alerts:
        - name: "High Error Rate"
          condition: "error_rate > 5%"
          severity: "critical"
        - name: "High Latency"
          condition: "p95_latency > 15s"
          severity: "warning"
        - name: "Service Down"
          condition: "up == 0"
          severity: "critical"
      required: true

    - id: O-010
      name: "Alert Channels"
      description: "알림 채널 설정"
      channels:
        - "PagerDuty/Opsgenie (critical)"
        - "Slack (warning)"
        - "Email (info)"
      required: true
```

---

## 6. 운영 준비

### 6.1 문서화

```yaml
# checklist/documentation.yaml

documentation:
  technical:
    - id: D-001
      name: "Architecture Documentation"
      description: "아키텍처 문서"
      contents:
        - "System overview"
        - "Component diagram"
        - "Data flow"
        - "Integration points"
      required: true

    - id: D-002
      name: "API Documentation"
      description: "API 문서"
      format: "OpenAPI 3.0"
      coverage: "100%"
      required: true

    - id: D-003
      name: "Configuration Guide"
      description: "설정 가이드"
      contents:
        - "Environment variables"
        - "Feature flags"
        - "Tuning parameters"
      required: true

  operational:
    - id: D-004
      name: "Runbook"
      description: "런북"
      procedures:
        - "Deployment"
        - "Rollback"
        - "Scaling"
        - "Incident response"
        - "Common issues troubleshooting"
      required: true

    - id: D-005
      name: "On-Call Guide"
      description: "온콜 가이드"
      contents:
        - "Escalation procedures"
        - "Contact information"
        - "Dashboard links"
        - "Common alert responses"
      required: true

    - id: D-006
      name: "Disaster Recovery Plan"
      description: "재해 복구 계획"
      contents:
        - "RTO/RPO definitions"
        - "Recovery procedures"
        - "Communication plan"
      rto: "< 4 hours"
      rpo: "< 1 hour"
      required: true
```

### 6.2 운영 체계

```yaml
# checklist/operations.yaml

operations:
  team:
    - id: OP-001
      name: "On-Call Rotation"
      description: "온콜 로테이션"
      requirements:
        - "24/7 coverage"
        - "At least 2 people per rotation"
        - "Documented escalation path"
      required: true

    - id: OP-002
      name: "Incident Response Process"
      description: "인시던트 대응 프로세스"
      sla:
        critical: "15 min response"
        high: "1 hour response"
        medium: "4 hours response"
      required: true

  processes:
    - id: OP-003
      name: "Change Management"
      description: "변경 관리"
      requirements:
        - "Change approval process"
        - "Change window definition"
        - "Rollback criteria"
      required: true

    - id: OP-004
      name: "Capacity Planning"
      description: "용량 계획"
      reviews:
        - "Monthly capacity review"
        - "Quarterly growth projection"
      required: true

    - id: OP-005
      name: "Cost Management"
      description: "비용 관리"
      requirements:
        - "Budget alerts"
        - "Monthly cost review"
        - "Cost allocation"
      required: true

  testing:
    - id: OP-006
      name: "Chaos Engineering"
      description: "카오스 엔지니어링"
      experiments:
        - "Pod failure"
        - "Network partition"
        - "LLM provider outage"
      frequency: "Monthly"
      required: false

    - id: OP-007
      name: "DR Testing"
      description: "재해 복구 테스트"
      frequency: "Quarterly"
      required: true
```

---

## 7. 프로덕션 체크리스트 실행

### 7.1 자동화된 검증 스크립트

```python
# scripts/production_readiness_check.py

import yaml
import subprocess
import sys
from dataclasses import dataclass
from typing import List, Dict
from enum import Enum

class CheckStatus(Enum):
    PASS = "✅"
    FAIL = "❌"
    WARN = "⚠️"
    SKIP = "⏭️"

@dataclass
class CheckResult:
    id: str
    name: str
    status: CheckStatus
    message: str
    required: bool

def load_checklist(path: str) -> Dict:
    with open(path) as f:
        return yaml.safe_load(f)

def run_check(check: Dict) -> CheckResult:
    """개별 체크 실행"""

    check_id = check["id"]
    name = check["name"]
    required = check.get("required", True)

    try:
        if "command" in check:
            result = subprocess.run(
                check["command"],
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                return CheckResult(
                    id=check_id,
                    name=name,
                    status=CheckStatus.PASS,
                    message="Check passed",
                    required=required
                )
            else:
                return CheckResult(
                    id=check_id,
                    name=name,
                    status=CheckStatus.FAIL,
                    message=result.stderr or "Command failed",
                    required=required
                )

        elif "verification" in check:
            # 수동 검증 필요
            return CheckResult(
                id=check_id,
                name=name,
                status=CheckStatus.WARN,
                message="Manual verification required",
                required=required
            )

        else:
            return CheckResult(
                id=check_id,
                name=name,
                status=CheckStatus.SKIP,
                message="No verification method defined",
                required=required
            )

    except Exception as e:
        return CheckResult(
            id=check_id,
            name=name,
            status=CheckStatus.FAIL,
            message=str(e),
            required=required
        )

def generate_report(results: List[CheckResult]) -> str:
    """리포트 생성"""

    report = []
    report.append("=" * 60)
    report.append("PRODUCTION READINESS REPORT")
    report.append("=" * 60)
    report.append("")

    # 요약
    passed = sum(1 for r in results if r.status == CheckStatus.PASS)
    failed = sum(1 for r in results if r.status == CheckStatus.FAIL)
    warned = sum(1 for r in results if r.status == CheckStatus.WARN)

    report.append(f"Total Checks: {len(results)}")
    report.append(f"Passed: {passed}")
    report.append(f"Failed: {failed}")
    report.append(f"Warnings: {warned}")
    report.append("")

    # 상세 결과
    report.append("-" * 60)
    report.append("DETAILED RESULTS")
    report.append("-" * 60)

    for result in results:
        req_marker = "[REQUIRED]" if result.required else "[OPTIONAL]"
        report.append(
            f"{result.status.value} {result.id}: {result.name} {req_marker}"
        )
        if result.status != CheckStatus.PASS:
            report.append(f"   → {result.message}")

    report.append("")
    report.append("=" * 60)

    # 최종 판정
    required_failed = sum(
        1 for r in results
        if r.status == CheckStatus.FAIL and r.required
    )

    if required_failed > 0:
        report.append("❌ NOT READY FOR PRODUCTION")
        report.append(f"   {required_failed} required checks failed")
    else:
        report.append("✅ READY FOR PRODUCTION")

    report.append("=" * 60)

    return "\n".join(report)

def main():
    # 체크리스트 로드
    checklists = [
        "checklist/agent-quality.yaml",
        "checklist/testing.yaml",
        "checklist/infrastructure.yaml",
        "checklist/security.yaml",
        "checklist/observability.yaml",
    ]

    all_results = []

    for checklist_path in checklists:
        checklist = load_checklist(checklist_path)

        for category, checks in checklist.items():
            if isinstance(checks, list):
                for check in checks:
                    result = run_check(check)
                    all_results.append(result)

    # 리포트 생성
    report = generate_report(all_results)
    print(report)

    # 필수 체크 실패 시 exit code 1
    required_failed = any(
        r.status == CheckStatus.FAIL and r.required
        for r in all_results
    )

    sys.exit(1 if required_failed else 0)

if __name__ == "__main__":
    main()
```

### 7.2 체크리스트 실행 예시

```bash
# 프로덕션 준비도 체크 실행
python scripts/production_readiness_check.py

# 특정 카테고리만 체크
python scripts/production_readiness_check.py --category security

# JSON 리포트 출력
python scripts/production_readiness_check.py --format json --output report.json

# CI/CD에서 실행
# .github/workflows/production-check.yaml
# on: [push]
# jobs:
#   production-readiness:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - run: python scripts/production_readiness_check.py
```

---

## 8. 배포 승인 프로세스

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Production Deployment Approval                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 자동화된 체크 통과                                                   │
│     └── production_readiness_check.py                                   │
│                                                                          │
│  2. 코드 리뷰 승인                                                       │
│     └── 최소 2명의 리뷰어 승인                                          │
│                                                                          │
│  3. 품질 게이트 통과                                                     │
│     └── CI/CD 파이프라인 성공                                           │
│                                                                          │
│  4. 보안 리뷰 (중요 변경 시)                                            │
│     └── 보안팀 승인                                                     │
│                                                                          │
│  5. 배포 승인                                                            │
│     └── 테크 리드 또는 SRE 승인                                         │
│                                                                          │
│  6. 배포 실행                                                            │
│     └── 카나리 → 점진적 롤아웃 → 전체 배포                              │
│                                                                          │
│  7. 배포 후 검증                                                         │
│     └── 스모크 테스트 + 메트릭 모니터링                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 다음 단계

- [비용 최적화](./cost-optimization) - 운영 비용 관리
- [CI/CD 파이프라인](../deployment/cicd) - 배포 자동화
- [Guardrails](../security/guardrails) - 안전 가드레일
