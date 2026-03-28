const Module = require('module');
const path = require('path');

const mappings = {
  '@app/common': 'libs/common/src',
  '@app/db': 'libs/db/src',
  '@app/shared-type': 'libs/shared-type/src',
  '@app/workflow-dsl': 'libs/workflow-dsl/src',
  '@app/feature-workflow': 'libs/feature/workflow/src',
  '@app/feature-agent-registry': 'libs/feature/agent/registry/src',
  '@app/feature-agent-claude-code': 'libs/feature/agent/claude-code/src',
  '@app/feature-agent-sandbox': 'libs/feature/agent/sandbox/src',
  '@app/feature-agent-credential-proxy': 'libs/feature/agent/credential-proxy/src',
  '@app/feature-agent-prompt': 'libs/feature/agent/shared/prompt/src',
  '@app/feature-agent-mcp-policy': 'libs/feature/agent/shared/mcp-policy/src',
  '@app/feature-agent-security': 'libs/feature/agent/shared/security/src',
  '@app/feature-webhook': 'libs/feature/webhook/src',
  '@app/feature-gate': 'libs/feature/gate/src',
  '@app/feature-tenant': 'libs/feature/tenant/src',
};

const distDir = path.join(__dirname, 'dist');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  for (const [alias, target] of Object.entries(mappings)) {
    if (request === alias) {
      return originalResolve.call(this, path.join(distDir, target), parent, isMain, options);
    }
    if (request.startsWith(alias + '/')) {
      const rest = request.slice(alias.length);
      return originalResolve.call(this, path.join(distDir, target, '..', rest), parent, isMain, options);
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
