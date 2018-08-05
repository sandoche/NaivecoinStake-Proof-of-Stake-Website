const Merge = require('webpack-merge');
const ProdConfig = require('./webpack.prod.js');
const path = require('path');
const webpack = require('webpack');
const WebpackPwaManifest = require('webpack-pwa-manifest');

module.exports = Merge(ProdConfig, {
  plugins: [
    new WebpackPwaManifest({
      name: 'NaivecoinStake',
      short_name: 'NaivecoinStake',
      description: 'A tutorial for building a Proof of Stake cryptocurrency',
      orientation: "portrait",
      display: "standalone",
      start_url: "/",
      theme_color: "#616bf2",
      background_color: "#ffffff",
      icons: [
        {
          src: path.resolve('icon.png'),
          sizes: [96, 128, 192, 256, 384, 512]
        },
      ]
    })
  ]
});
