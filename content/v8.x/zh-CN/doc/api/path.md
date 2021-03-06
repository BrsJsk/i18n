# 路径

<!--introduced_in=v0.10.0-->

> 稳定性：2 - 稳定的

`path` 模块提供了用于处理文件和目录路径的实用工具。 可以通过如下方式使用它：

```js
const path = require('path');
```

## Windows 与 POSIX

`path` 模块的默认操作根据运行 Node.js 应用程序的操作系统而有所不同。 具体而言，当在 Windows 操作系统上运行时，`path` 模块会假定 Windows 风格的路径会被使用。

So using `path.basename()` might yield different results on POSIX and Windows:

在 POSIX 系统上：

```js
path.basename('C:\\temp\\myfile.html');
// Returns: 'C:\\temp\\myfile.html'
```

在 Windows 系统上：

```js
path.basename('C:\\temp\\myfile.html');
//返回: 'myfile.html'
```

要想在任何操作系统上处理 Windows 文件路径时获得一致的结果，请使用 [`path.win32`][]：

在 POSIX 和 Windows 系统上：

```js
path.win32.basename('C:\\temp\\myfile.html');
//返回: 'myfile.html'
```

若要在任何操作系统上处理 POSIX 文件路径时获得一致的结果, 请使用 [`path.posix`] []:

在 POSIX 和 Windows 系统上:

```js
path.posix.basename('/tmp/myfile.html');
// 返回: 'myfile.html'
```

* 注意: *在 Windows 系统上，Node.js 遵循单驱动器工作目录的概念。 使用不带反斜线的驱动器路径时, 可以观察到此行为。 例如，`path.resolve('c:\\')` 可能返回与 `path.resolve('c:')` 不同的结果。 请参阅 [此 MSDN 页面](https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247.aspx#fully_qualified_vs._relative_paths) 以获取更多信息。

## path.basename(path[, ext])

<!-- YAML
added: v0.1.25
changes:

  - version: v6.0.0
    pr-url: https://github.com/nodejs/node/pull/5348
    description: Passing a non-string as the `path` argument will throw now.
-->

* `path` {string}
* `ext` {string} 可选的文件扩展名
* 返回：{string}

和 Unix 的 `basename` 命令类似，`path.basename()` 方法返回 `path` 中的最后部分。 尾部的目录分隔符将被忽略，请参阅 [`path.sep`][]。

例如：

```js
path.basename('/foo/bar/baz/asdf/quux.html');
// Returns: 'quux.html'

path.basename('/foo/bar/baz/asdf/quux.html', '.html');
// Returns: 'quux'
```

如果 `path` 不是字符串，或者如果给出 `ext` 但不是字符串时，将会抛出 [`TypeError`][]。

## path.delimiter

<!-- YAML
added: v0.9.3
-->

* {string}

提供针对特定平台的路径分隔符：

* `;` 用于 Windows
* `:` 用于 POSIX

例如，在 POSIX 系统上：

```js
console.log(process.env.PATH);
// Prints: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin'

process.env.PATH.split(path.delimiter);
// Returns: ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/bin']
```

在 Windows 系统上：

```js
console.log(process.env.PATH);
// Prints: 'C:\Windows\system32;C:\Windows;C:\Program Files\node\'

process.env.PATH.split(path.delimiter);
// Returns ['C:\\Windows\\system32', 'C:\\Windows', 'C:\\Program Files\\node\\']
```

## path.dirname(path)

<!-- YAML
added: v0.1.16
changes:

  - version: v6.0.0
    pr-url: https://github.com/nodejs/node/pull/5348
    description: Passing a non-string as the `path` argument will throw now.
-->

* `path` {string}
* 返回：{string}

和 Unix 的 `dirname` 命令类似，`path.dirname()` 方法返回 `path` 中的目录名。 尾部的目录分隔符将被忽略，请参阅 [`path.sep`][]。

例如：

```js
path.dirname('/foo/bar/baz/asdf/quux');
// Returns: '/foo/bar/baz/asdf'
```

如果 `path` 不是字符串，则会抛出 [`TypeError`][]。

## path.extname(path)

<!-- YAML
added: v0.1.25
changes:

  - version: v6.0.0
    pr-url: https://github.com/nodejs/node/pull/5348
    description: Passing a non-string as the `path` argument will throw now.
-->

* `path` {string}
* 返回：{string}

`path.extname()` 方法返回 `path` 中的扩展名，也就是在 `path` 最后一部分字符串中，从最后一次出现 `.` (点) 字符到字符串结束为止。 如果在 `path` 的最后一部分没有 `.`，或者如果 `path` 中文件名部分 (请参阅 `path.basename()`) 的首字符是 `.`，则返回空字符串。

例如：

```js
path.extname('index.html');
// Returns: '.html'

path.extname('index.coffee.md');
// Returns: '.md'

path.extname('index.');
// Returns: '.'

path.extname('index');
// Returns: ''

path.extname('.index');
// Returns: ''
```

如果 `path` 不是字符串，则抛出 [`TypeError`][]。

## path.format(pathObject)

<!-- YAML
added: v0.11.15
-->

* `pathObject` {Object} 
  * `dir` {string}
  * `root` {string}
  * `base` {string}
  * `name` {string}
  * `ext` {string}
* 返回：{string}

`path.format()` 从对象返回一个路径字符串。 这与 [`path.parse()`][] 正好相反。

当为 `pathObject` 提供属性时，注意存在一些组合，其中一些属性优先于另一些属性：

* 如果提供了 `pathObject.dir`，则会忽略 `pathObject.root`
* 如果 `pathObject.base` 存在，则 `pathObject.ext` 和 `pathObject.name` 会被忽略

例如，在 POSIX 系统上，

```js
// If `dir`, `root` and `base` are provided,
// `${dir}${path.sep}${base}`
// will be returned. `root` is ignored.
path.format({
  root: '/ignored',
  dir: '/home/user/dir',
  base: 'file.txt'
});
// Returns: '/home/user/dir/file.txt'

// `root` will be used if `dir` is not specified.
// If only `root` is provided or `dir` is equal to `root` then the
// platform separator will not be included. `ext` will be ignored.
path.format({
  root: '/',
  base: 'file.txt',
  ext: 'ignored'
});
// Returns: '/file.txt'

// `name` + `ext` will be used if `base` is not specified.
path.format({
  root: '/',
  name: 'file',
  ext: '.txt'
});
// Returns: '/file.txt'
```

在 Windows 系统上：

```js
path.format({
  dir: 'C:\\path\\dir',
  base: 'file.txt'
});
// Returns: 'C:\\path\\dir\\file.txt'
```

## path.isAbsolute(path)

<!-- YAML
added: v0.11.2
-->

* `path` {string}
* 返回：{boolean}

`path.isAbsolute()` 方法检测 `path` 是否为绝对路径。

如果给定的 `path` 为长度为零的字符串，则返回 `false` 。

例如，在 POSIX 系统上：

```js
path.isAbsolute('/foo/bar'); // true
path.isAbsolute('/baz/..');  // true
path.isAbsolute('qux/');     // false
path.isAbsolute('.');        // false
```

在 Windows 系统上：

```js
path.isAbsolute('//server');    // true
path.isAbsolute('\\\\server');  // true
path.isAbsolute('C:/foo/..');   // true
path.isAbsolute('C:\\foo\\..'); // true
path.isAbsolute('bar\\baz');    // false
path.isAbsolute('bar/baz');     // false
path.isAbsolute('.');           // false
```

如果 `path` 不是字符串，则抛出 [`TypeError`][]。

## path.join([...paths])

<!-- YAML
added: v0.1.16
-->

* `...paths` {string} 路径片段序列
* 返回：{string}

`path.join()` 方法使用平台特定的分隔符作为路径分隔符，将给定的 `path` 片段连接到一起，并规范化生成的路径。

长度为零的 `path` 片段将被忽略。 如果连接后的路径字符串为零长度字符串，则会返回 `'.'`，代表当前的工作目录。

例如：

```js
path.join('/foo', 'bar', 'baz/asdf', 'quux', '..');
// Returns: '/foo/bar/baz/asdf'

path.join('foo', {}, 'bar');
// throws 'TypeError: Path must be a string. Received {}'
```

如果任何路径片段不是字符串，则会抛出 [`TypeError`][]。

## path.normalize(path)

<!-- YAML
added: v0.1.23
-->

* `path` {string}
* 返回：{string}

`path.normalize()` 方法规范化给定的 `path`，解析 `'..'` 和`'.'` 片段。

当找到多个连续的路径片段分隔符时 (例如：在 POSIX 系统上的 `/`，以及在 Windows 系统上的 `` 或 `/`)，它们将被替换为单个平台特定的路径片段分隔符 (在 POSIX 系统上为 `/`，在 Windows 系统上为 ``)。 尾部的分隔符会被保留。

如果 `path` 为零长度字符串，则会返回 `'.'`，代表当前工作目录。

例如，在 POSIX 系统上：

```js
path.normalize('/foo/bar//baz/asdf/quux/..');
// Returns: '/foo/bar/baz/asdf'
```

在 Windows 系统上：

```js
path.normalize('C:\\temp\\\\foo\\bar\\..\\');
// Returns: 'C:\\temp\\foo\\'
```

由于 Windows 能够识别多种路径分隔符，因此这两种路径分隔符都会被替换为 Windows 的首选分隔符 (``) 实例：

```js
path.win32.normalize('C:////temp\\\\/\\/\\/foo/bar');
// Returns: 'C:\\temp\\foo\\bar'
```

如果 `path` 不是字符串，则会抛出 [`TypeError`][]。

## path.parse(path)

<!-- YAML
added: v0.11.15
-->

* `path` {string}
* 返回：{Object}

`path.parse()` 方法返回一个对象，该对象的属性代表 `path` 中的重要元素。 目录尾部的分隔符将被忽略，请参阅 [`path.sep`][]。

返回的对象含有如下属性：

* `dir` {string}
* `root` {string}
* `base` {string}
* `name` {string}
* `ext` {string}

例如，在 POSIX 系统上：

```js
path.parse('/home/user/dir/file.txt');
// Returns:
// { root: '/',
//   dir: '/home/user/dir',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file' }
```

```text
┌─────────────────────┬────────────┐
│          dir        │    base    │
├──────┬              ├──────┬─────┤
│ root │              │ name │ ext │
"  /    home/user/dir / file  .txt "
└──────┴──────────────┴──────┴─────┘
(all spaces in the "" line should be ignored — they are purely for formatting)
```

在 Windows 系统上：

```js
path.parse('C:\\path\\dir\\file.txt');
// Returns:
// { root: 'C:\\',
//   dir: 'C:\\path\\dir',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file' }
```

```text
┌─────────────────────┬────────────┐
│          dir        │    base    │
├──────┬              ├──────┬─────┤
│ root │              │ name │ ext │
" C:\      path\dir   \ file  .txt "
└──────┴──────────────┴──────┴─────┘
(all spaces in the "" line should be ignored — they are purely for formatting)
```

如果 `path` 不是字符串，则会抛出 [`TypeError`][]。

## path.posix

<!-- YAML
added: v0.11.15
-->

* {Object}

`path.posix` 属性提供对 `path` 方法的专门针对 POSIX 系统实现的访问。

## path.relative(from, to)

<!-- YAML
added: v0.5.0
changes:

  - version: v6.8.0
    pr-url: https://github.com/nodejs/node/pull/8523
    description: On Windows, the leading slashes for UNC paths are now included
                 in the return value.
-->

* `from` {string}
* `to` {string}
* 返回：{string}

`path.relative()` 方法返回基于当前工作目录的从 `from` 到 `to` 的相对路径。 如果 `from` 和 `to` 均被解析为同一路径 (针对两者分别调用 `path.resolve()` 后)，则会返回一个零长度字符串。

如果将零长度字符串传入 `from` 或 `to`，则当前工作目录，而不是该零长度字符串会被使用。

例如，在 POSIX 系统上：

```js
path.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb');
// Returns: '../../impl/bbb'
```

在 Windows 系统上：

```js
path.relative('C:\\orandea\\test\\aaa', 'C:\\orandea\\impl\\bbb');
// Returns: '..\\..\\impl\\bbb'
```

如果 `from` 或 `to` 不是字符串，则会抛出 [`TypeError`][]。

## path.resolve([...paths])

<!-- YAML
added: v0.3.4
-->

* `...paths` {string} 路径或路径片段序列
* 返回：{string}

`path.resolve()` 方法将路径或路径片段序列解析为一个绝对路径。

给定的路径序列会被从右向左进行处理，每个后续的 `path` 前置，直到构造出一个绝对路径。 例如：对于给定的路径片段序列：`/foo`, `/bar`, `baz`，调用 `path.resolve('/foo', '/bar', 'baz')` 将会返回 `/bar/baz`。

如果在处理了所有给定的 `path` 片段后仍未生成一个绝对路径，则会使用当前工作目录。

结果路径会被规范化，同时结尾的斜杠会被删除，除非路径被解析为根目录。

零长度的 `path` 片段将被忽略。

如果没有传入 `path` 片段，`path.resolve()` 将会返回当前工作目录的绝对路径。

例如：

```js
path.resolve('/foo/bar', './baz');
// Returns: '/foo/bar/baz'

path.resolve('/foo/bar', '/tmp/file/');
// Returns: '/tmp/file'

path.resolve('wwwroot', 'static_files/png/', '../gif/image.gif');
// if the current working directory is /home/myself/node,
// this returns '/home/myself/node/wwwroot/static_files/gif/image.gif'
```

如果任何一个参数不是字符串，则会抛出 [`TypeError`][] 。

## path.sep

<!-- YAML
added: v0.7.9
-->

* {string}

提供针对特定平台的路径片段分隔符：

* `` 在 Windows 系统上
* `/` 在 POSIX 系统上

例如，在 POSIX 系统上：

```js
'foo/bar/baz'.split(path.sep);
// Returns: ['foo', 'bar', 'baz']
```

在 Windows 系统上：

```js
'foo\\bar\\baz'.split(path.sep);
// Returns: ['foo', 'bar', 'baz']
```

*注意*：在 Windows 系统上，正斜杠 (`/`) 和反斜杠 (``) 都是被接受的路径片段分隔符；但是，`path` 方法只会添加反斜杠 (``) 。

## path.win32

<!-- YAML
added: v0.11.15
-->

* {Object}

`path.win32` 属性提供对 `path` 方法的专门针对 Windows 系统实现的访问。