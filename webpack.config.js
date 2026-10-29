const path = require('path')
module.exports = {
    target: 'electron-renderer',
    entry: './src/index.ts',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'index.js', library: { type: 'commonjs2' } },
    resolve: { extensions: ['.ts', '.js'] },
    module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
    externals: [/^@angular\//, /^tabby-/, /^rxjs(?:\/|$)/],
    devtool: false,
}
