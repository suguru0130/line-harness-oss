module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      // Absolute paths: pnpm does not hoist these where @babel/core can see the bare names.
      [require.resolve('babel-preset-expo'), { jsxImportSource: 'nativewind' }],
      require.resolve('nativewind/babel'),
    ],
  }
}
