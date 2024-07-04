export {
  LCS,
  diffComm,
  diffIndices,
  diffPatch,
  diff3MergeRegions,
  diff3Merge,
  mergeDiff3,
  merge,
  mergeDigIn,
  patch,
  stripPatch,
  invertPatch
};


// Text diff algorithm following Hunt and McIlroy 1976.
// J. W. Hunt and M. D. McIlroy, An algorithm for differential buffer
// comparison, Bell Telephone Laboratories CSTR #41 (1976)
// http://www.cs.dartmouth.edu/~doug/
// https://en.wikipedia.org/wiki/Longest_common_subsequence_problem
//
// Expects two arrays, finds longest common sequence
function LCS(buffer1, buffer2) {

  let equivalenceClasses = {};
  for (let j = 0; j < buffer2.length; j++) {
    const item = buffer2[j];
    if (equivalenceClasses[item]) {
      equivalenceClasses[item].push(j);
    } else {
      equivalenceClasses[item] = [j];
    }
  }

  const NULLRESULT = { buffer1index: -1, buffer2index: -1, chain: null };
  let candidates = [NULLRESULT];

  for (let i = 0; i < buffer1.length; i++) {
    const item = buffer1[i];
    const buffer2indices = equivalenceClasses[item] || [];
    let r = 0;
    let c = candidates[0];

    for (let jx = 0; jx < buffer2indices.length; jx++) {
      const j = buffer2indices[jx];

      let s;
      for (s = r; s < candidates.length; s++) {
        if ((candidates[s].buffer2index < j) && ((s === candidates.length - 1) || (candidates[s + 1].buffer2index > j))) {
          break;
        }
      }

      if (s < candidates.length) {
        const newCandidate = { buffer1index: i, buffer2index: j, chain: candidates[s] };
        if (r === candidates.length) {
          candidates.push(c);
        } else {
          candidates[r] = c;
        }
        r = s + 1;
        c = newCandidate;
        if (r === candidates.length) {
          break; // no point in examining further (j)s
        }
      }
    }

    candidates[r] = c;
  }

  // At this point, we know the LCS: it's in the reverse of the
  // linked-list through .chain of candidates[candidates.length - 1].

  return candidates[candidates.length - 1];
}


// We apply the LCS to build a 'comm'-style picture of the
// differences between buffer1 and buffer2.
function diffComm(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  let result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;
  let common = {common: []};

  function processCommon() {
    if (common.common.length) {
      common.common.reverse();
      result.push(common);
      common = {common: []};
    }
  }

  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    let different = {buffer1: [], buffer2: []};

    while (--tail1 > candidate.buffer1index) {
      different.buffer1.push(buffer1[tail1]);
    }

    while (--tail2 > candidate.buffer2index) {
      different.buffer2.push(buffer2[tail2]);
    }

    if (different.buffer1.length || different.buffer2.length) {
      processCommon();
      different.buffer1.reverse();
      different.buffer2.reverse();
      result.push(different);
    }

    if (tail1 >= 0) {
      common.common.push(buffer1[tail1]);
    }
  }

  processCommon();

  result.reverse();
  return result;
}


// We apply the LCS to give a simple representation of the
// offsets and lengths of mismatched chunks in the input
// buffers. This is used by diff3MergeRegions.
function diffIndices(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  let result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;

  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    const mismatchLength1 = tail1 - candidate.buffer1index - 1;
    const mismatchLength2 = tail2 - candidate.buffer2index - 1;
    tail1 = candidate.buffer1index;
    tail2 = candidate.buffer2index;

    if (mismatchLength1 || mismatchLength2) {
      result.push({
        buffer1: [tail1 + 1, mismatchLength1],
        buffer1Content: buffer1.slice(tail1 + 1, tail1 + 1 + mismatchLength1),
        buffer2: [tail2 + 1, mismatchLength2],
        buffer2Content: buffer2.slice(tail2 + 1, tail2 + 1 + mismatchLength2)
      });
    }
  }

  result.reverse();
  return result;
}


// We apply the LCS to build a JSON representation of a
// diff(1)-style patch.
function diffPatch(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  let result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;

  function chunkDescription(buffer, offset, length) {
    let chunk = [];
    for (let i = 0; i < length; i++) {
      chunk.push(buffer[offset + i]);
    }
    return {
      offset: offset,
      length: length,
      chunk: chunk
    };
  }

  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    const mismatchLength1 = tail1 - candidate.buffer1index - 1;
    const mismatchLength2 = tail2 - candidate.buffer2index - 1;
    tail1 = candidate.buffer1index;
    tail2 = candidate.buffer2index;

    if (mismatchLength1 || mismatchLength2) {
      result.push({
        buffer1: chunkDescription(buffer1, candidate.buffer1index + 1, mismatchLength1),
        buffer2: chunkDescription(buffer2, candidate.buffer2index + 1, mismatchLength2)
      });
    }
  }

  result.reverse();
  return result;
}


// Given three buffers, A, O, and B, where both A and B are
// independently derived from O, returns a fairly complicated
// internal representation of merge decisions it's taken. The
// interested reader may wish to consult
//
// Sanjeev Khanna, Keshav Kunal, and Benjamin C. Pierce.
// 'A Formal Investigation of ' In Arvind and Prasad,
// editors, Foundations of Software Technology and Theoretical
// Computer Science (FSTTCS), December 2007.
//
// (http://www.cis.upenn.edu/~bcpierce/papers/diff3-short.pdf)
//
function diff3MergeRegions(a, o, b) {

  // "hunks" are array subsets where `a` or `b` are different from `o`
  // https://www.gnu.org/software/diffutils/manual/html_node/diff3-Hunks.html
  let hunks = [];
  function addHunk(h, ab) {
    hunks.push({
      ab: ab,
      oStart: h.buffer1[0],
      oLength: h.buffer1[1],   // length of o to remove
      abStart: h.buffer2[0],
      abLength: h.buffer2[1]   // length of a/b to insert
      // abContent: (ab === 'a' ? a : b).slice(h.buffer2[0], h.buffer2[0] + h.buffer2[1])
    });
  }

  diffIndices(o, a).forEach(item => addHunk(item, 'a'));
  diffIndices(o, b).forEach(item => addHunk(item, 'b'));
  hunks.sort((x,y) => x.oStart - y.oStart);

  let results = [];
  let currOffset = 0;

  function advanceTo(endOffset) {
    if (endOffset > currOffset) {
      results.push({
        stable: true,
        buffer: 'o',
        bufferStart: currOffset,
        bufferLength: endOffset - currOffset,
        bufferContent: o.slice(currOffset, endOffset)
      });
      currOffset = endOffset;
    }
  }

  while (hunks.length) {
    let hunk = hunks.shift();
    let regionStart = hunk.oStart;
    let regionEnd = hunk.oStart + hunk.oLength;
    let regionHunks = [hunk];
    advanceTo(regionStart);

    // Try to pull next overlapping hunk into this region
    while (hunks.length) {
      const nextHunk = hunks[0];
      const nextHunkStart = nextHunk.oStart;
      if (nextHunkStart > regionEnd) break;   // no overlap

      regionEnd = Math.max(regionEnd, nextHunkStart + nextHunk.oLength);
      regionHunks.push(hunks.shift());
    }

    if (regionHunks.length === 1) {
      // Only one hunk touches this region, meaning that there is no conflict here.
      // Either `a` or `b` is inserting into a region of `o` unchanged by the other.
      if (hunk.abLength > 0) {
        const buffer = (hunk.ab === 'a' ? a : b);
        results.push({
          stable: true,
          buffer: hunk.ab,
          bufferStart: hunk.abStart,
          bufferLength: hunk.abLength,
          bufferContent: buffer.slice(hunk.abStart, hunk.abStart + hunk.abLength)
        });
      }
    } else {
      // A true a/b conflict. Determine the bounds involved from `a`, `o`, and `b`.
      // Effectively merge all the `a` hunks into one giant hunk, then do the
      // same for the `b` hunks; then, correct for skew in the regions of `o`
      // that each side changed, and report appropriate spans for the three sides.
      let bounds = {
        a: [a.length, -1, o.length, -1],
        b: [b.length, -1, o.length, -1]
      };
      while (regionHunks.length) {
        hunk = regionHunks.shift();
        const oStart = hunk.oStart;
        const oEnd = oStart + hunk.oLength;
        const abStart = hunk.abStart;
        const abEnd = abStart + hunk.abLength;
        let b = bounds[hunk.ab];
        b[0] = Math.min(abStart, b[0]);
        b[1] = Math.max(abEnd, b[1]);
        b[2] = Math.min(oStart, b[2]);
        b[3] = Math.max(oEnd, b[3]);
      }

      const aStart = bounds.a[0] + (regionStart - bounds.a[2]);
      const aEnd = bounds.a[1] + (regionEnd - bounds.a[3]);
      const bStart = bounds.b[0] + (regionStart - bounds.b[2]);
      const bEnd = bounds.b[1] + (regionEnd - bounds.b[3]);

      let result = {
        stable: false,
        aStart: aStart,
        aLength: aEnd - aStart,
        aContent: a.slice(aStart, aEnd),
        oStart: regionStart,
        oLength: regionEnd - regionStart,
        oContent: o.slice(regionStart, regionEnd),
        bStart: bStart,
        bLength: bEnd - bStart,
        bContent: b.slice(bStart, bEnd)
      };
      results.push(result);
    }
    currOffset = regionEnd;
  }

  advanceTo(o.length);

  return results;
}


// Applies the output of diff3MergeRegions to actually
// construct the merged buffer; the returned result alternates
// between 'ok' and 'conflict' blocks.
// A "false conflict" is where `a` and `b` both change the same from `o`
function diff3Merge(a, o, b, options) {
  let defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/
  };
  options = Object.assign(defaults, options);

  if (typeof a === 'string') a = a.split(options.stringSeparator);
  if (typeof o === 'string') o = o.split(options.stringSeparator);
  if (typeof b === 'string') b = b.split(options.stringSeparator);

  let results = [];
  const regions = diff3MergeRegions(a, o, b);

  let okBuffer = [];
  function flushOk() {
    if (okBuffer.length) {
      results.push({ ok: okBuffer });
    }
    okBuffer = [];
  }

  function isFalseConflict(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  regions.forEach(region =>  {
    if (region.stable) {
      okBuffer.push(...region.bufferContent);
    } else {
      if (options.excludeFalseConflicts && isFalseConflict(region.aContent, region.bContent)) {
        okBuffer.push(...region.aContent);
      } else {
        flushOk();
        results.push({
          conflict: {
            a: region.aContent,
            aIndex: region.aStart,
            o: region.oContent,
            oIndex: region.oStart,
            b: region.bContent,
            bIndex: region.bStart
          }
        });
      }
    }
  });

  flushOk();
  return results;
}


function mergeDiff3(a, o, b, options) {
  const defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/,
    label: {}
  };
  options = Object.assign(defaults, options);

  const aSection = '<<<<<<<' + (options.label.a ? ` ${options.label.a}` : '');
  const oSection = '|||||||' + (options.label.o ? ` ${options.label.o}` : '');
  const xSection = '=======';
  const bSection = '>>>>>>>' + (options.label.b ? ` ${options.label.b}` : '');

  const regions = diff3Merge(a, o, b, options);
  let conflict = false;
  let result = [];

  regions.forEach(region => {
    if (region.ok) {
      result = result.concat(region.ok);
    } else if (region.conflict) {
      conflict = true;
      result = result.concat(
        [aSection],
        region.conflict.a,
        [oSection],
        region.conflict.o,
        [xSection],
        region.conflict.b,
        [bSection]
      );
    }
  });

  return {
    conflict: conflict,
    result: result
  };
}


function merge(a, o, b, options) {
  const defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/,
    label: {}
  };
  options = Object.assign(defaults, options);

  const aSection = '<<<<<<<' + (options.label.a ? ` ${options.label.a}` : '');
  const xSection = '=======';
  const bSection = '>>>>>>>' + (options.label.b ? ` ${options.label.b}` : '');

  const regions = diff3Merge(a, o, b, options);
  let conflict = false;
  let result = [];

  regions.forEach(region => {
    if (region.ok) {
      result = result.concat(region.ok);
    } else if (region.conflict) {
      conflict = true;
      result = result.concat(
        [aSection],
        region.conflict.a,
        [xSection],
        region.conflict.b,
        [bSection]
      );
    }
  });

  return {
    conflict: conflict,
    result: result
  };
}


function mergeDigIn(a, o, b, options) {
  const defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/,
    label: {}
  };
  options = Object.assign(defaults, options);

  const aSection = '<<<<<<<' + (options.label.a ? ` ${options.label.a}` : '');
  const xSection = '=======';
  const bSection = '>>>>>>>' + (options.label.b ? ` ${options.label.b}` : '');

  const regions = diff3Merge(a, o, b, options);
  let conflict = false;
  let result = [];

  regions.forEach(region => {
    if (region.ok) {
      result = result.concat(region.ok);
    } else {
      const c = diffComm(region.conflict.a, region.conflict.b);
      for (let j = 0; j < c.length; j++) {
        let inner = c[j];
        if (inner.common) {
          result = result.concat(inner.common);
        } else {
          conflict = true;
          result = result.concat(
            [aSection],
            inner.buffer1,
            [xSection],
            inner.buffer2,
            [bSection]
          );
        }
      }
    }
  });

  return {
    conflict: conflict,
    result: result
  };
}


// Applies a patch to a buffer.
// Given buffer1 and buffer2, `patch(buffer1, diffPatch(buffer1, buffer2))` should give buffer2.
function patch(buffer, patch) {
  let result = [];
  let currOffset = 0;

  function advanceTo(targetOffset) {
    while (currOffset < targetOffset) {
      result.push(buffer[currOffset]);
      currOffset++;
    }
  }

  for (let chunkIndex = 0; chunkIndex < patch.length; chunkIndex++) {
    let chunk = patch[chunkIndex];
    advanceTo(chunk.buffer1.offset);
    for (let itemIndex = 0; itemIndex < chunk.buffer2.chunk.length; itemIndex++) {
      result.push(chunk.buffer2.chunk[itemIndex]);
    }
    currOffset += chunk.buffer1.length;
  }

  advanceTo(buffer.length);
  return result;
}


// Takes the output of diffPatch(), and removes extra information from it.
// It can still be used by patch(), below, but can no longer be inverted.
function stripPatch(patch) {
  return patch.map(chunk => ({
    buffer1: { offset: chunk.buffer1.offset, length: chunk.buffer1.length },
    buffer2: { chunk: chunk.buffer2.chunk }
  }));
}


// Takes the output of diffPatch(), and inverts the sense of it, so that it
// can be applied to buffer2 to give buffer1 rather than the other way around.
function invertPatch(patch) {
  return patch.map(chunk => ({
    buffer1: chunk.buffer2,
    buffer2: chunk.buffer1
  }));
}
