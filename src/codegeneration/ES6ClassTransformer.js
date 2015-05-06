// Copyright 2015 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  CONSTRUCTOR
} from '../syntax/PredefinedName.js';
import {
  AnonBlock,
  ClassExpression,
  ClassDeclaration,
  FormalParameterList,
  PropertyMethodAssignment,
} from '../syntax/trees/ParseTrees.js';
import {
  GET_ACCESSOR,
  PROPERTY_METHOD_ASSIGNMENT,
  PROPERTY_VARIABLE_DECLARATION,
  SET_ACCESSOR,
} from '../syntax/trees/ParseTreeType.js';
import {TempVarTransformer} from './TempVarTransformer.js';
import {
  createBindingIdentifier,
  createFunctionBody,
  createIdentifierToken,
  createImmediatelyInvokedFunctionExpression,
  createLiteralPropertyName,
  createRestParameter,
} from './ParseTreeFactory.js';
import {
  parsePropertyDefinition,
  parseStatement,
} from './PlaceholderParser.js';
import {propName} from '../staticsemantics/PropName.js';
import {prependStatements} from './PrependStatements.js';
import {
  transformConstructor,
  getInstanceInitExpression,
} from './MemberVariableConstructorTransformer.js';

/**
 * Transform member variable declarations to valid ES6 statements.
 *
 * - instance variables are initialized in the constructor,
 * - static variables are initialized after the class definition,
 *   through `Object.defineProperty(...)`
 */
export class ES6ClassTransformer extends TempVarTransformer {
  transformClassElements_(tree) {
    let elements = [];
    let initInstanceVars = [], initStaticVars = [];
    let constructor;
    let constructorIndex = 0;

    tree.elements.forEach((tree) => {
      let initVars;
      if (tree.isStatic) {
        initVars = initStaticVars;
      } else {
        initVars = initInstanceVars;
      }

      switch (tree.type) {
        case GET_ACCESSOR:
        case SET_ACCESSOR:
          elements.push(this.transformAny(tree));
          break;

        case PROPERTY_METHOD_ASSIGNMENT:
          if (!tree.isStatic && propName(tree) === CONSTRUCTOR) {
            constructor = tree;
            constructorIndex = elements.length;
          } else {
            elements.push(this.transformAny(tree));
          }
          break;

        case PROPERTY_VARIABLE_DECLARATION:
          tree = this.transformAny(tree);
          if (tree.initializer !== null) {
            initVars.push(tree);
          }
          break;

        default:
          throw new Error(`Unexpected class element: ${tree.type}`);
      }
    });

    if (initInstanceVars.length > 0) {
      let initExpression = getInstanceInitExpression(initInstanceVars);

      if (!constructor) {
        constructor = this.getDefaultConstructor_(tree);
      }

      constructor = transformConstructor(constructor, initExpression,
          tree.superClass);
    }

    if (constructor) {
      elements.splice(constructorIndex, 0, constructor);
    }

    return {
      elements,
      initStaticVars,
    };
  }

  /**
   * Transforms a single class declaration
   *
   * @param {ClassDeclaration} tree
   * @return {ParseTree}
   */
  transformClassDeclaration(tree) {
    let {
      elements,
      initStaticVars,
    } = this.transformClassElements_(tree);

    let superClass = this.transformAny(tree.superClass);
    let classDecl = new ClassDeclaration(tree.location, tree.name, superClass,
        elements, tree.annotations, tree.typeParameters);

    if (initStaticVars.length === 0) {
      return classDecl;
    }

    let statements = createStaticInitializerStatements(tree.name, initStaticVars);
    statements = prependStatements(statements, classDecl);

    return new AnonBlock(null, statements);
  }

  /**
   * Transforms a single class expression
   *
   * @param {ClassExpression} tree
   * @return {ParseTree}
   */
  transformClassExpression(tree) {
    let {
      elements,
      initStaticVars,
    } = this.transformClassElements_(tree);

    let superClass = this.transformAny(tree.superClass);
    let classExpression = new ClassExpression(tree.location, tree.name,
        superClass, elements, tree.annotations, tree.typeParameters);

    if (initStaticVars.length === 0) {
      return classExpression;
    }

    this.pushTempScope();
    let id = this.getTempIdentifierToken();
    let className = createBindingIdentifier(id);
    let statements = [
      parseStatement `let ${className} = ${classExpression}`,
      ...createStaticInitializerStatements(className, initStaticVars),
      parseStatement `return ${className}`
    ];
    let body = createFunctionBody(statements);
    this.popTempScope();

    return createImmediatelyInvokedFunctionExpression(body);
  }

  getDefaultConstructor_(tree) {
    if (tree.superClass) {
      let param = createRestParameter(createIdentifierToken('args'));
      let paramList = new FormalParameterList(null, [param]);
      let body = createFunctionBody([parseStatement `super(...args)`]);
      let name = createLiteralPropertyName(CONSTRUCTOR);
      return new PropertyMethodAssignment(tree.location, false, null, name,
          paramList, null, [], body);
    }

    return parsePropertyDefinition `constructor() {}`;
  }
}

// TODO(vicb): Does not handle computed properties
function createStaticInitializerStatements(className, initStaticMemberVars) {
  return initStaticMemberVars.map((mv) => {
    let propName = mv.name.literalToken.value;
    return parseStatement
        `Object.defineProperty(${className}, ${propName}, {enumerable: true,
        configurable: true, value: ${mv.initializer}, writable: true})`;
  });
}
