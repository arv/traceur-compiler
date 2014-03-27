import {Map} from './src/runtime/polyfills/Map';

var m = new Map;
m.set(1, 1);
console.log(m.get(1));
m.delete(1);
console.log(m.size);

m.set(null, null);
console.log(m.size);

m.set(undefined, undefined);
console.log(m.size);

m.set(true, true);
console.log(m.size);

m.set(false, false);
console.log(m.size);

m.delete(false);
m.delete(null);
console.log(m.size);

m.forEach((key, val, map) => {
  console.log(key, val, map);
});

for (var i = 0; i < 20; i++) {
  m.set(i, i);
}

for (var i = 0; i < 20; i++) {
  m.delete(i);
}

for (var [k, v] of m.entries()) {
  console.log(k, v);
}

for (var k of m.keys()) {
  console.log(k);
}

for (var v of m.values()) {
  console.log(v);
}


var o = {};
m.set(o, o);

for (var [k, v] of m) {
  console.log(k, v);
}