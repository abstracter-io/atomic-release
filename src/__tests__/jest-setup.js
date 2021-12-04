const { default: matchers } = require("expect/build/matchers");

const parseJSON = (str) => {
  return typeof str === "string" ? JSON.parse(str) : {};
};

expect.extend({
  jsonMatching(received, expected) {
    return matchers.toEqual(parseJSON(received), expected);
  },

  jsonContaining(received, expected) {
    let expectedJson = expected;

    if (expected instanceof Array) {
      expectedJson = expect.arrayContaining(expected);
    }
    //
    else {
      expectedJson = expect.objectContaining(expected);
    }

    return matchers.toEqual(parseJSON(received), expectedJson);
  },
});
