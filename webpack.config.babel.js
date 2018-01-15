import path from 'path';
import webpack from 'webpack';

export default {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'pixi-tiledmap.min.js',
        libraryTarget: 'umd',
        library: 'pixi-tiledmap'
    },
    module: {
        rules: [
            {
                test: /\.(js)$/,
                use: 'babel-loader'
            }
        ]
    },
    target: 'web',
    plugins: [
        new webpack.optimize.UglifyJsPlugin({ sourceMap: true })
    ],
    devtool: 'source-map',
    node: {
        fs: 'empty'
    }
};