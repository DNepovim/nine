// Expo applies babel-preset-expo implicitly when no config exists. The moment one does,
// the preset has to be named here or it is lost — and with it the React Compiler, which
// app.json turns on through `experiments.reactCompiler` and the preset is what wires in.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  }
}
