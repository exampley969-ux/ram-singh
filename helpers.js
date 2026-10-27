const vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
function loadEngine(files) {
  const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
  (files || ['core-logic.js', 'profile-schema.js']).forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
  vm.runInContext('this.X = { Engine, QUESTIONS, DIM_ORDER, DIMS, ARCH, ProfileSchema: typeof ProfileSchema === "undefined" ? null : ProfileSchema }', ctx);
  return ctx.X;
}
module.exports = { loadEngine, DIR };
