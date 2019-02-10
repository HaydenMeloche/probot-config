/* eslint-env jest */
const getConfig = require('./index');

const { fn } = jest;
let number = 0;

function mockContext(getContents) {
  return {
    repo(params) {
      return Object.assign(
        {
          owner: 'owner',
          repo: 'repo',
        },
        params
      );
    },

    github: {
      repos: {
        async getContents(params) {
          const content = Buffer.from(getContents(params)).toString('base64');
          return {
            data: {
              content,
            },
          };
        },
      },
    },
  };
}

function getIncrementedFileName() {
  number++;
  return number + '-yaml.yml'
}

function mockError(code) {
  const err = new Error('Not found');
  err.code = code;
  throw err;
}

test('returns null on 404', async () => {
  const spy = fn()
    .mockImplementationOnce(() => mockError(404))
    .mockImplementationOnce(() => mockError(404))
    .mockImplementationOnce(() => mockError(500));

  const filename = getIncrementedFileName();

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual(null);

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: '.github',
    path: '.github/' + filename,
  });
});

test('loads a direct config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo')
    .mockImplementationOnce(() => mockError(500));

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
  });

  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
});

test('merges the default config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo')
    .mockImplementationOnce(() => mockError(500));

  const config = await getConfig(mockContext(spy), filename, {
    def: true,
  });
  expect(config).toEqual({
    foo: 'foo',
    def: true,
  });

  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
});

test('merges a base config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: base')
    .mockImplementationOnce(() => 'bar: bar2\nbaz: baz');

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
    baz: 'baz',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'base',
    path: '.github/' + filename,
  });
});

test('merges the base and default config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\n_extends: base')
    .mockImplementationOnce(() => 'bar: bar');

  const config = await getConfig(mockContext(spy), filename, {
    def: true,
  });
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
    def: true,
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'base',
    path: '.github/' + filename,
  });
});

test('merges a base config from another organization', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: other/base')
    .mockImplementationOnce(() => 'bar: bar2\nbaz: baz');

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
    baz: 'baz',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'other',
    repo: 'base',
    path: '.github/' + filename,
  });
});

test('merges a base config with a custom path', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: base:test.yml')
    .mockImplementationOnce(() => 'bar: bar2\nbaz: baz');

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
    baz: 'baz',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'base',
    path: filename,
  });
});

test('ignores a missing base config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: base')
    .mockImplementationOnce(() => mockError(404));

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: 'base',
    path: '.github/' + filename,
  });
});

test('loads an empty config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => '')
    .mockImplementationOnce(() => mockError(500));

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({});

  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
});

test('throws on error', async () => {
  const filename = getIncrementedFileName();
  try {
    expect.assertions(1);
    const spy = jest.fn().mockImplementation(() => mockError(500));
    await getConfig(mockContext(spy), filename);
  } catch (e) {
    expect(e.code).toBe(500);
  }
});

test('throws on a non-string base', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: { nope }')
    .mockImplementationOnce(() => mockError(500));

  try {
    expect.assertions(1);
    await getConfig(mockContext(spy), filename);
  } catch (e) {
    expect(e.message).toMatch(/invalid/i);
  }
});

test('throws on an invalid base', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: "nope:"')
    .mockImplementationOnce(() => mockError(500));

  try {
    expect.assertions(1);
    await getConfig(mockContext(spy), filename);
  } catch (e) {
    expect(e.message).toMatch(/nope:/);
  }
});

test('uses the .github directory on a .github repo', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => 'foo: foo\nbar: bar\n_extends: .github')
    .mockImplementationOnce(() => 'bar: bar2\nbaz: baz');

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
    baz: 'baz',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: '.github',
    path: '.github/' + filename,
  });
});

test('defaults to .github repo if no config found', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(() => mockError(404))
    .mockImplementationOnce(() => 'foo: foo\nbar: bar');

  const config = await getConfig(mockContext(spy), filename);
  expect(config).toEqual({
    foo: 'foo',
    bar: 'bar',
  });

  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    path: '.github/' + filename,
  });
  expect(spy).toHaveBeenLastCalledWith({
    owner: 'owner',
    repo: '.github',
    path: '.github/' + filename,
  });
});

test('deep merges the base config', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(
      () => 'obj:\n  foo:\n  - name: master\n_extends: .github'
    )
    .mockImplementationOnce(() => 'obj:\n  foo:\n  - name: develop');

  const config = await getConfig(mockContext(spy), filename);

  expect(config).toEqual({
    obj: {
      foo: [
        {
          name: 'develop',
        },
        {
          name: 'master',
        },
      ],
    },
  });
});

test('accepts deepmerge options', async () => {
  const filename = getIncrementedFileName();
  const spy = fn()
    .mockImplementationOnce(
      () =>
        'foo:\n  - name: master\n    shouldChange: changed\n_extends: .github'
    )
    .mockImplementationOnce(
      () =>
        'foo:\n  - name: develop\n  - name: master\n    shouldChange: should'
    );

  const customMerge = fn().mockImplementationOnce();
  await getConfig(
    mockContext(spy),
    filename,
    {},
    {
      arrayMerge: customMerge,
    }
  );
  expect(customMerge).toHaveBeenCalled();
});
