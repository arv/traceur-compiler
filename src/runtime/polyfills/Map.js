
var deletedSentinel = {};
var counter = 0;

function getObjectKey(key) {
  var hc = key.__hashCode__;
  if (hc && hc.key === key)
    return hc.value;
  var value = counter++;
  key.__hashCode__ = {key, value};
  return value;
}

function lookupEntry(map, key) {
  switch (typeof key) {
    case 'string':
      return map.stringMap_[key];
    case 'object':
      if (key !== null)
        return map.objectMap_[getObjectKey(key)];
  }
  return map.primitiveMap_[key];
}

function setEntryInMap(map, entry, key) {
  switch (typeof key) {
    case 'string':
      map.stringMap_[key] = entry;
    case 'object':
      if (key !== null)
        map.objectMap_[getObjectKey(key)] = entry;
  }
  map.primitiveMap_[key] = entry;
}

function removeEntryInMap(map, entry, key) {
  switch (typeof key) {
    case 'string':
      delete map.stringMap_[key];
    case 'object':
      if (key !== null)
        delete map.objectMap_[getObjectKey(key)];
  }
  delete map.primitiveMap_[key];
}

function initMap(map) {
  map.numberOfDeletedElements_ = 0;
  map.stringMap_ = Object.create(null);
  map.objectMap_ = Object.create(null);
  map.primitiveMap_ = Object.create(null);
  map.entries_ = [];
  map.openIterators_ = 0;
}

function compactMap(map) {
  var newEntries = [];
  var newEntry = 0;
  var entries = map.entries_;
  for (var i = 0; i < entries.length; i += 2) {
    var key = entries[i];
    var value = entries[i + 1];
    if (key !== deletedSentinel) {
      setEntryInMap(map, newEntry, key);
      newEntries[newEntry++] = key;
      newEntries[newEntry++] = value;
    }
  }
  map.entries_ = newEntries;
  map.numberOfDeletedElements_ = 0;
}

function maybeCompactMap(map) {
  var length = map.entries_.length;
  // Don't bother compacting if small.
  // Compact once we have more than 50% deleted elements.
  if (!map.openIterators_ && length > 16 &&
      map.numberOfDeletedElements_ > length / 4) {

    compactMap(map);
  }
}

export class Map {
  constructor() {
    initMap(this);
  }

  get(key) {
    var entry = lookupEntry(this, key);
    if (entry !== undefined)
      return this.entries_[entry + 1];
    return undefined;
  }

  set(key, value) {
    var entry = lookupEntry(this, key);
    if (entry === undefined) {
      entry = this.entries_.length;
      this.entries_[entry] = key;
      setEntryInMap(this, entry, key);
    }
    this.entries_[entry + 1] = value;
  }

  delete(key) {
    var entry = lookupEntry(this, key);
    if (entry === undefined)
      return false;

    this.numberOfDeletedElements_++;

    removeEntryInMap(this, key);
    this.entries_[entry] = this.entries_[entry] = deletedSentinel;
    maybeCompactMap(this);
    return true;
  }

  get size() {
    return this.entries_.length / 2 - this.numberOfDeletedElements_;
  }

  clear() {
    initMap(this);
  }

  forEach(func, thisArg = undefined) {
    try {
      this.openIterators_++;
      var entries = this.entries_;
      for (var i = 0; i < entries.length; i += 2) {
        var key = entries[i];
        if (key !== deletedSentinel) {
          var value = entries[i + 1];
          func.call(thisArg || this, value, key, this);
        }
      }
    } finally {
      this.openIterators_--;
      maybeCompactMap(this);
    }
  }

  keys() {
    return new MapIterator(this, MAP_ITERATOR_KIND_KEYS);
  }

  values() {
    return new MapIterator(this, MAP_ITERATOR_KIND_VALUES);
  }

  entries() {
    return new MapIterator(this, MAP_ITERATOR_KIND_ENTRIES);
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

var MAP_ITERATOR_KIND_KEYS = 1;
var MAP_ITERATOR_KIND_VALUES = 2;
var MAP_ITERATOR_KIND_ENTRIES = 3;

class MapIterator {
  constructor(map, kind) {
    // This leaks if the iterators are not finished but we cannot do better.
    map.openIterators_++;
    this.map_ = map;
    this.index_ = 0;
    this.kind_ = kind;
  }

  next() {
    var entries = this.map_.entries_;
    while (this.index_ < entries.length) {
      var key = entries[this.index_++];
      var value = entries[this.index_++];
      if (key === deletedSentinel)
        continue;

      if (this.kind_ == MAP_ITERATOR_KIND_KEYS)
        return {value: key, done: false};
      if (this.kind_ == MAP_ITERATOR_KIND_VALUES)
        return {value: value, done: false};
      return {value: [key, value], done: false};
    }

    this.map_.openIterators_--;
    return {value: undefined, done: true};
  }

  [Symbol.iterator]() {
    return this;
  }
}