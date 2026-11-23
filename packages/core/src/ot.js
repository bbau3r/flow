// Edits to the script as operations, so that several people can write in one script at once and
// every change can be told apart by who made it. An operation walks the text from the start and
// says what happens to it: a positive number keeps that many characters, a negative one deletes
// that many, and a string inserts itself. `diffText` turns an edit into one, and `transform` lets
// two edits made at the same time to the same text both apply, in either order, with the same
// result. This is the operational transformation of ot.js, by Tim Baumann (MIT), kept to text.

const isRetain = (op) => typeof op === 'number' && op > 0;
const isDelete = (op) => typeof op === 'number' && op < 0;
const isInsert = (op) => typeof op === 'string';

// Builds an operation, merging neighbours of a kind, and always inserting before deleting at
// the same place, so equal edits come out as equal lists.
class Builder {
  ops = [];
  base = 0;
  target = 0;

  retain(n) {
    if (!n) return this;
    this.base += n;
    this.target += n;
    if (isRetain(this.ops.at(-1))) this.ops[this.ops.length - 1] += n;
    else this.ops.push(n);
    return this;
  }

  insert(text) {
    if (!text) return this;
    this.target += text.length;
    const { ops } = this;
    const last = ops.at(-1);
    if (isInsert(last)) ops[ops.length - 1] += text;
    else if (isDelete(last)) {
      if (isInsert(ops.at(-2))) ops[ops.length - 2] += text;
      else {
        ops.push(last);
        ops[ops.length - 2] = text;
      }
    } else ops.push(text);
    return this;
  }

  delete(n) {
    const count = -Math.abs(n);
    if (!count) return this;
    this.base -= count;
    if (isDelete(this.ops.at(-1))) this.ops[this.ops.length - 1] += count;
    else this.ops.push(count);
    return this;
  }
}

/** How long the text an operation applies to is. */
export const baseLength = (op) => op.reduce((sum, part) => sum + (isInsert(part) ? 0 : Math.abs(part)), 0);

/** How long the text is once an operation has applied. */
export const targetLength = (op) => op.reduce((sum, part) => sum + (isInsert(part) ? part.length : isRetain(part) ? part : 0), 0);

/** Whether `value` is an operation, for one that came from someone else. */
export function isOperation(value) {
  return Array.isArray(value) && value.every((part) => (isInsert(part) || (Number.isSafeInteger(part) && part !== 0)));
}

/** Whether an operation changes nothing. */
export const isNoop = (op) => op.every(isRetain);

/** The operation that turns `before` into `after`: what lies between their shared start and end. */
export function diffText(before, after) {
  let head = 0;
  const max = Math.min(before.length, after.length);
  while (head < max && before.charCodeAt(head) === after.charCodeAt(head)) head++;
  let tail = 0;
  while (tail < max - head && before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)) tail++;
  return new Builder()
    .retain(head)
    .insert(after.slice(head, after.length - tail))
    .delete(before.length - tail - head)
    .retain(tail).ops;
}

/** Applies an operation to the text it was made for. */
export function applyOperation(text, op) {
  if (baseLength(op) !== text.length) throw new Error('The operation was made for different text.');
  let out = '';
  let at = 0;
  for (const part of op) {
    if (isRetain(part)) {
      out += text.slice(at, at + part);
      at += part;
    } else if (isInsert(part)) out += part;
    else at -= part;
  }
  return out;
}

/**
 * The operation as replacements of the text it applies to, { from, to, text }, in order and
 * apart, with offsets into that text.
 */
export function operationChanges(op) {
  const changes = [];
  let at = 0;
  const add = (from, to, text) => {
    const last = changes.at(-1);
    if (last && last.to === from) {
      last.to = to;
      last.text += text;
    } else changes.push({ from, to, text });
  };
  for (const part of op) {
    if (isRetain(part)) at += part;
    else if (isInsert(part)) add(at, at, part);
    else {
      add(at, at - part, '');
      at -= part;
    }
  }
  return changes;
}

/** One operation doing what `a` then `b` do. */
export function compose(a, b) {
  if (targetLength(a) !== baseLength(b)) throw new Error('These operations don’t follow each other.');
  const out = new Builder();
  let i = 0;
  let j = 0;
  let x = a[i++];
  let y = b[j++];
  for (;;) {
    if (x === undefined && y === undefined) break;
    if (isDelete(x)) {
      out.delete(x);
      x = a[i++];
      continue;
    }
    if (isInsert(y)) {
      out.insert(y);
      y = b[j++];
      continue;
    }
    if (x === undefined || y === undefined) throw new Error('These operations don’t follow each other.');
    if (isRetain(x) && isRetain(y)) {
      const n = Math.min(x, y);
      out.retain(n);
      [x, y] = [x - n || a[i++], y - n || b[j++]];
    } else if (isInsert(x) && isDelete(y)) {
      const n = Math.min(x.length, -y);
      [x, y] = [x.slice(n) || a[i++], y + n || b[j++]];
    } else if (isInsert(x) && isRetain(y)) {
      const n = Math.min(x.length, y);
      out.insert(x.slice(0, n));
      [x, y] = [x.slice(n) || a[i++], y - n || b[j++]];
    } else {
      // Kept, then deleted.
      const n = Math.min(x, -y);
      out.delete(n);
      [x, y] = [x - n || a[i++], y + n || b[j++]];
    }
  }
  return out.ops;
}

/**
 * Two operations made at the same time to the same text, as [a', b']: a' does what `a` did,
 * after `b`, and b' does what `b` did, after `a`, so both orders end on the same text. Where both
 * insert at one place, `a`'s text comes first.
 */
export function transform(a, b) {
  if (baseLength(a) !== baseLength(b)) throw new Error('These operations were made for different text.');
  const a2 = new Builder();
  const b2 = new Builder();
  let i = 0;
  let j = 0;
  let x = a[i++];
  let y = b[j++];
  for (;;) {
    if (x === undefined && y === undefined) break;
    if (isInsert(x)) {
      a2.insert(x);
      b2.retain(x.length);
      x = a[i++];
      continue;
    }
    if (isInsert(y)) {
      a2.retain(y.length);
      b2.insert(y);
      y = b[j++];
      continue;
    }
    if (x === undefined || y === undefined) throw new Error('These operations were made for different text.');
    if (isRetain(x) && isRetain(y)) {
      const n = Math.min(x, y);
      a2.retain(n);
      b2.retain(n);
      [x, y] = [x - n || a[i++], y - n || b[j++]];
    } else if (isDelete(x) && isDelete(y)) {
      // Both deleted it, so neither has to.
      const n = Math.min(-x, -y);
      [x, y] = [x + n || a[i++], y + n || b[j++]];
    } else if (isDelete(x)) {
      const n = Math.min(-x, y);
      a2.delete(n);
      [x, y] = [x + n || a[i++], y - n || b[j++]];
    } else {
      const n = Math.min(x, -y);
      b2.delete(n);
      [x, y] = [x - n || a[i++], y + n || b[j++]];
    }
  }
  return [a2.ops, b2.ops];
}
