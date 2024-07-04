module.exports.newArray = (len, start = 0, step = 1) => {
  return new Array(len).fill(0).map((_, i) => start + i * step);
};
