// Copyright 2013 Traceur Authors.
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

import {
  BindingElement,
  BindingIdentifier,
  FormalParameter,
  FormalParameterList,
  FunctionBody,
  FunctionExpression,
} from '../syntax/trees/ParseTrees.js';
import {ModuleTransformer} from './ModuleTransformer.js';
import {
  createIdentifierExpression,
  createStringLiteralToken
} from './ParseTreeFactory.js';
import globalThis from './globalThis.js';
import {
  parseExpression,
  parseStatement,
  parseStatements,
  parsePropertyDefinition
} from './PlaceholderParser.js';
import filePathToBindingName from './module/filePathToBindingName.js';
import scopeContainsThis from './scopeContainsThis.js';

export class AmdTransformer extends ModuleTransformer {

  constructor(identifierGenerator, reporter, options = undefined) {
    super(identifierGenerator, reporter, options);
    this.dependencies = [];
    this.anonymousModule =
        options && !options.bundle && options.moduleName !== true;
  }

  getModuleName(tree) {
    if (this.anonymousModule)
      return null;
    return tree.moduleName;
  }

  getExportProperties() {
    let properties = super.getExportProperties();

    if (this.exportVisitor_.hasExports())
      properties.push(parsePropertyDefinition `__esModule: true`);
    return properties;
  }

  moduleProlog() {
    // insert the default handling after the "use strict" and __moduleName lines
    let locals = this.dependencies.map((dep) => {
      let local = createIdentifierExpression(dep.local);
      return parseStatement
          `if (!${local} || !${local}.__esModule)
            ${local} = {default: ${local}}`;
    });
    return super.moduleProlog().concat(locals);
  }

  wrapModule(statements) {
    let depPaths = this.dependencies.map((dep) => dep.path);
    let formals = this.dependencies.map((dep) => {
      return new FormalParameter(null,
          new BindingElement(null,
              new BindingIdentifier(null, dep.local), null),
          null, []);
      });

    let hasTopLevelThis = statements.some(scopeContainsThis);

    let parameterList = new FormalParameterList(null, formals);
    let body = new FunctionBody(null, statements);
    let func = new FunctionExpression(null, null, null,
                                      parameterList, null, [], body);

    if (hasTopLevelThis)
      func = parseExpression `${func}.bind(${globalThis()})`;

    if (this.moduleName) {
      return parseStatements `define(${this.moduleName}, ${depPaths}, ${func});`;
    }
    else {
      return parseStatements `define(${depPaths}, ${func});`;
    }
  }

  transformModuleSpecifier(tree) {
    let value = tree.token.processedValue;
    let preferredName = filePathToBindingName(value);
    let localName = this.getTempIdentifierToken(preferredName);

    // AMD does not allow .js
    let stringLiteral = createStringLiteralToken(value.replace(/\.js$/, ''));
    this.dependencies.push({path: stringLiteral, local: localName});
    return createIdentifierExpression(localName);
  }
}
