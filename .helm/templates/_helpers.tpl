{{- define "ai-sdlc.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ai-sdlc.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "ai-sdlc.labels" -}}
helm.sh/chart: {{ include "ai-sdlc.name" . }}
{{ include "ai-sdlc.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "ai-sdlc.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ai-sdlc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
