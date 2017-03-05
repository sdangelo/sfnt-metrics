#!/usr/bin/env node

var fs = require("fs");
var SFNTMetrics = require("./sfnt-metrics.js");

var data = fs.readFileSync(process.argv[2], "utf8");
var font = JSON.parse(data);

console.log(JSON.stringify(SFNTMetrics.getMetrics(font, [SFNTMetrics.plugins.cff]), null, 2));
