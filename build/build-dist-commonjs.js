// Copyright 2016 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This compiles all files in src to dist/commonjs.

'use strict';

var path = require('path');
var traceur = require('../');

var options = {
  modules: 'commonjs',
  importRuntime: true,
};

// Compile all files
var src = path.resolve(__dirname, '../src/');
var dst = path.resolve(__dirname, '../dist/commonjs/');
traceur.compileAllJsFilesInDir(src, dst, options);

// Now recompile symbols.js without --symbols
options.symbols = false;
var compiler = new traceur.NodeCompiler(options);
var symbolsPath = 'runtime/modules/symbols.js';
src = path.join(src, symbolsPath);
dst = path.join(dst, symbolsPath);
compiler.compileSingleFile(src, dst, function(err) {
  throw new Error('While reading ' + src + ': ' + err);
});
