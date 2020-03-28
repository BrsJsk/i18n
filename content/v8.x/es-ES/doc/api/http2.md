# HTTP/2

<!-- YAML
added: v8.4.0
changes:

  - version: v8.13.0
    pr-url: https://github.com/nodejs/node/pull/22466
    description: HTTP/2 is now Stable. Previously, it had been Experimental.
-->

<!--introduced_in=v8.4.0-->

> Estability: 2 - Estable

El módulo `http2` provee una implementación del protocolo [HTTP/2](https://tools.ietf.org/html/rfc7540) . Se puede acceder a través de:

```js
const http2 = require('http2');
```

## API de Núcleo

The Core API provides a low-level interface designed specifically around support for HTTP/2 protocol features. *No* está específicamente diseñada para la compatibilidad con la API existente del módulo [HTTP/1](http.html) . However, the [Compatibility API](#http2_compatibility_api) is.

The `http2` Core API is much more symmetric between client and server than the `http` API. For instance, most events, like `error`, `connect` and `stream`, can be emitted either by client-side code or server-side code.

### Ejemplo del lado del servidor

La siguiente ilustra un servidor simple de HTTP/2 utilizando la API de núcleo. Since there are no browsers known that support [unencrypted HTTP/2](https://http2.github.io/faq/#does-http2-require-encryption), the use of [`http2.createSecureServer()`][] is necessary when communicating with browser clients.

```js
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('localhost-privkey.pem'),
  cert: fs.readFileSync('localhost-cert.pem')
});
server.on('error', (err) => console.error(err));

server.on('stream', (stream, headers) => {
  // stream es un Duplex
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  stream.end('<h1>Hello World</h1>');
});

server.listen(8443);
```

Para generar el certificado y la clave para este ejemplo, ejecute:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
  -keyout localhost-privkey.pem -out localhost-cert.pem
```

### Ejemplo del lado del cliente

Lo siguiente ilustra un cliente HTTP/2:

```js
const http2 = require('http2');
const fs = require('fs');
const client = http2.connect('https://localhost:8443', {
  ca: fs.readFileSync('localhost-cert.pem')
});
client.on('error', (err) => console.error(err));

const req = client.request({ ':path': '/' });

req.on('response', (headers, flags) => {
  for (const name in headers) {
    console.log(`${name}: ${headers[name]}`);
  }
});

req.setEncoding('utf8');
let data = '';
req.on('data', (chunk) => { data += chunk; });
req.on('end', () => {
  console.log(`\n${data}`);
  client.close();
});
req.end();
```

### Clase: Http2Session

<!-- YAML
added: v8.4.0
-->

* Extiende a: {EventEmitter}

Instances of the `http2.Http2Session` class represent an active communications session between an HTTP/2 client and server. Las instancias de esta clase *no* están destinadas a ser construidas directamente por el código de usuario.

Each `Http2Session` instance will exhibit slightly different behaviors depending on whether it is operating as a server or a client. The `http2session.type` property can be used to determine the mode in which an `Http2Session` is operating. On the server side, user code should rarely have occasion to work with the `Http2Session` object directly, with most actions typically taken through interactions with either the `Http2Server` or `Http2Stream` objects.

User code will not create `Http2Session` instances directly. Server-side `Http2Session` instances are created by the `Http2Server` instance when a new HTTP/2 connection is received. Client-side `Http2Session` instances are created using the `http2.connect()` method.

#### Http2Session y Sockets

Every `Http2Session` instance is associated with exactly one [`net.Socket`][] or [`tls.TLSSocket`][] when it is created. When either the `Socket` or the `Http2Session` are destroyed, both will be destroyed.

Because the of the specific serialization and processing requirements imposed by the HTTP/2 protocol, it is not recommended for user code to read data from or write data to a `Socket` instance bound to a `Http2Session`. Doing so can put the HTTP/2 session into an indeterminate state causing the session and the socket to become unusable.

Once a `Socket` has been bound to an `Http2Session`, user code should rely solely on the API of the `Http2Session`.

#### Evento: 'close'

<!-- YAML
added: v8.4.0
-->

El evento de `'close'` se emite una vez que la `Http2Session` ha sido destruida. Its listener does not expect any arguments.

#### Evento: 'connect'

<!-- YAML
added: v8.4.0
-->

* `session` {Http2Session}
* `socket` {net.Socket}

The `'connect'` event is emitted once the `Http2Session` has been successfully connected to the remote peer and communication may begin.

*Nota*: El código de usuario generalmente no escuchará a este evento directamente.

#### Evento: 'error'

<!-- YAML
added: v8.4.0
-->

* `error` {Error}

The `'error'` event is emitted when an error occurs during the processing of an `Http2Session`.

#### Evento: 'frameError'

<!-- YAML
added: v8.4.0
-->

* `type` {integer} El tipo de frame.
* `code` {integer} El código de error.
* `id` {integer} The stream id (or `0` if the frame isn't associated with a stream).

The `'frameError'` event is emitted when an error occurs while attempting to send a frame on the session. Si el frame no pudo ser enviado se asocia con un `Http2Stream` específico, se realizará un intento para emitir un evento `'frameError'` en el `Http2Stream` .

If the `'frameError'` event is associated with a stream, the stream will be closed and destroyed immediately following the `'frameError'` event. If the event is not associated with a stream, the `Http2Session` will be shut down immediately following the `'frameError'` event.

#### Evento: 'goaway'

<!-- YAML
added: v8.4.0
-->

* `errorCode` {number} El código de error HTTP/2 especificado en el frame `GOAWAY` .
* `lastStreamID` {number} The ID of the last stream the remote peer successfully processed (or `0` if no ID is specified).
* `opaqueData` {Buffer} If additional opaque data was included in the `GOAWAY` frame, a `Buffer` instance will be passed containing that data.

El evento `'goaway'` se emite cuando se recibe un frame de `GOAWAY` .

The `Http2Session` instance will be shut down automatically when the `'goaway'` event is emitted.

#### Evento: 'localSettings'

<!-- YAML
added: v8.4.0
-->

* `settings` {HTTP/2 Settings Object} Una copia recibida del frame `SETTINGS` .

The `'localSettings'` event is emitted when an acknowledgment `SETTINGS` frame has been received.

*Note*: When using `http2session.settings()` to submit new settings, the modified settings do not take effect until the `'localSettings'` event is emitted.

```js
session.settings({ enablePush: false });

session.on('localSettings', (settings) => {
  /** use the new settings **/
});
```

#### Event: 'ping'

<!-- YAML
added: v8.13.0
-->

* `payload` {Buffer} The `PING` frame 8-byte payload

The `'ping'` event is emitted whenever a `PING` frame is received from the connected peer.

#### Evento: 'remoteSettings'

<!-- YAML
added: v8.4.0
-->

* `settings` {HTTP/2 Settings Object} Una copia recibida del frame `SETTINGS` .

The `'remoteSettings'` event is emitted when a new `SETTINGS` frame is received from the connected peer.

```js
session.on('remoteSettings', (settings) => {
  /** use the new settings **/
});
```

#### Evento: 'stream'

<!-- YAML
added: v8.4.0
-->

* `stream` {Http2Stream} Una referencia para el stream
* `headers` {HTTP/2 Headers Object} Un objeto describiendo los encabezados
* `flags` {number} Las banderas numéricas asociadas
* `rawHeaders` {Array} An array containing the raw header names followed by their respective values.

El evento `'stream'` se emite cuando un `Http2Stream` nuevo es creado.

```js
const http2 = require('http2');
session.on('stream', (stream, headers, flags) => {
  const method = headers[':method'];
  const path = headers[':path'];
  // ...
  stream.respond({
    ':status': 200,
    'content-type': 'text/plain'
  });
  stream.write('hello ');
  stream.end('world');
});
```

On the server side, user code will typically not listen for this event directly, and would instead register a handler for the `'stream'` event emitted by the `net.Server` or `tls.Server` instances returned by `http2.createServer()` and `http2.createSecureServer()`, respectively, as in the example below:

```js
const http2 = require('http2');

// Crea un servidor HTTP/2 sin cifrar
const server = http2.createServer();

server.on('stream', (stream, headers) => {
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  stream.end('<h1>Hello World</h1>');
});

server.listen(80);
```

#### Evento: 'timeout'

<!-- YAML
added: v8.4.0
-->

After the `http2session.setTimeout()` method is used to set the timeout period for this `Http2Session`, the `'timeout'` event is emitted if there is no activity on the `Http2Session` after the configured number of milliseconds.

```js
session.setTimeout(2000);
session.on('timeout', () => { /** .. **/ });
```

#### http2session.alpnProtocol

<!-- YAML
added: v8.11.2
-->

* Value: {string|undefined}

Value will be `undefined` if the `Http2Session` is not yet connected to a socket, `h2c` if the `Http2Session` is not connected to a `TLSSocket`, or will return the value of the connected `TLSSocket`'s own `alpnProtocol` property.

#### http2session.close([callback])

<!-- YAML
added: v8.11.2
-->

* `callback` {Function}

Gracefully closes the `Http2Session`, allowing any existing streams to complete on their own and preventing new `Http2Stream` instances from being created. Una vez cerrado, `http2session.destroy()` *might* ser llamado si no hay instancias de `Http2Stream` abiertas.

If specified, the `callback` function is registered as a handler for the `'close'` event.

#### http2session.closed

<!-- YAML
added: v8.11.2
-->

* Valor: {boolean}

Will be `true` if this `Http2Session` instance has been closed, otherwise `false`.

#### http2session.connecting

<!-- YAML
added: v8.11.2
-->

* {boolean}

Will be `true` if this `Http2Session` instance is still connecting, will be set to `false` before emitting `connect` event and/or calling the `http2.connect` callback.

#### http2session.destroy(\[error,\]\[code\])

<!-- YAML
added: v8.4.0
-->

* `error` {Error} An `Error` object if the `Http2Session` is being destroyed due to an error.
* `code` {number} El código de error HTTP/2 a enviar en el frame `GOAWAY` final. If unspecified, and `error` is not undefined, the default is `INTERNAL_ERROR`, otherwise defaults to `NO_ERROR`.
* Devuelve: {undefined}

Immediately terminates the `Http2Session` and the associated `net.Socket` or `tls.TLSSocket`.

Una vez destruido, el `Http2Session` emitirá el evento de `'close'` . If `error` is not undefined, an `'error'` event will be emitted immediately after the `'close'` event.

If there are any remaining open `Http2Streams` associated with the `Http2Session`, those will also be destroyed.

#### http2session.destroyed

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Will be `true` if this `Http2Session` instance has been destroyed and must no longer be used, otherwise `false`.

#### http2session.encrypted

<!-- YAML
added: v8.11.2
-->

* Valor: {boolean|undefined}

Value is `undefined` if the `Http2Session` session socket has not yet been connected, `true` if the `Http2Session` is connected with a `TLSSocket`, and `false` if the `Http2Session` is connected to any other kind of socket or stream.

#### http2session.goaway([code, [lastStreamID, [opaqueData]]])

<!-- YAML
added: v8.11.2
-->

* `code` {number} Un código de error de HTTP/2
* `lastStreamID` {number} La identificación numérica del último `Http2Stream` procesado
* `opaqueData` {Buffer|TypedArray|DataView} A `TypedArray` or `DataView` instance containing additional data to be carried within the `GOAWAY` frame.

Transmite un frame `GOAWAY` al peer conectado *sin* apagar la `Http2Session`.

#### http2session.localSettings

<!-- YAML
added: v8.4.0
-->

* Value: {HTTP/2 Settings Object}

A prototype-less object describing the current local settings of this `Http2Session`. Las configuraciones locales son locales para *this* `Http2Session` instancia.

#### http2session.originSet

<!-- YAML
added: v8.11.2
-->

* Value: {string[]|undefined}

If the `Http2Session` is connected to a `TLSSocket`, the `originSet` property will return an Array of origins for which the `Http2Session` may be considered authoritative.

The `originSet` property is only available when using a secure TLS connection.

#### http2session.pendingSettingsAck

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Indica si `Http2Session` está esperando actualmente una confirmación para un frame `SETTINGS` enviado o no. Will be `true` after calling the `http2session.settings()` method. Será `false` una vez que todos los frames de CONFIGURACIONES hayan sido reconocidos.

#### http2session.ping([payload, ]callback)

<!-- YAML
added: v8.9.3
-->

* `payload` {Buffer|TypedArray|DataView} ping payload opcional.
* `callback` {Function}
* Devuelve: {boolean}

Envía un frame de `PING` a un peer de HTTP/2 conectado. A `callback` function must be provided. The method will return `true` if the `PING` was sent, `false` otherwise.

The maximum number of outstanding (unacknowledged) pings is determined by the `maxOutstandingPings` configuration option. El máximo valor por defecto es 10.

If provided, the `payload` must be a `Buffer`, `TypedArray`, or `DataView` containing 8 bytes of data that will be transmitted with the `PING` and returned with the ping acknowledgment.

The callback will be invoked with three arguments: an error argument that will be `null` if the `PING` was successfully acknowledged, a `duration` argument that reports the number of milliseconds elapsed since the ping was sent and the acknowledgment was received, and a `Buffer` containing the 8-byte `PING` payload.

```js
session.ping(Buffer.from('abcdefgh'), (err, duration, payload) => {
  if (!err) {
    console.log(`Ping acknowledged in ${duration} milliseconds`);
    console.log(`With payload '${payload.toString()}`);
  }
});
```

If the `payload` argument is not specified, the default payload will be the 64-bit timestamp (little endian) marking the start of the `PING` duration.

#### http2session.ref()

<!-- YAML
added: v8.11.2
-->

Calls [`ref()`][`net.Socket.prototype.ref`] on this `Http2Session` instance's underlying [`net.Socket`].

#### http2session.remoteSettings

<!-- YAML
added: v8.4.0
-->

* Value: {HTTP/2 Settings Object}

A prototype-less object describing the current remote settings of this `Http2Session`. Las configuraciones remotas están establecidas por el peer HTTP/2 *connected* .

#### http2session.setTimeout(msecs, callback)

<!-- YAML
added: v8.4.0
-->

* `msecs` {number}
* `callback` {Function}
* Devuelve: {undefined}

Used to set a callback function that is called when there is no activity on the `Http2Session` after `msecs` milliseconds. The given `callback` is registered as a listener on the `'timeout'` event.

#### http2session.socket

<!-- YAML
added: v8.4.0
-->

* Valor: {net.Socket|tls.TLSSocket}

Returns a Proxy object that acts as a `net.Socket` (or `tls.TLSSocket`) but limits available methods to ones safe to use with HTTP/2.

`destroy`, `emit`, `end`, `pause`, `read`, `resume`, and `write` will throw an error with code `ERR_HTTP2_NO_SOCKET_MANIPULATION`. See [Http2Session and Sockets](#http2_http2session_and_sockets) for more information.

El método `setTimeout` será llamado en esta `Http2Session`.

Todas las otras interacciones serán enrutadas directamente al socket.

#### http2session.state

<!-- YAML
added: v8.4.0
-->

Provides miscellaneous information about the current state of the `Http2Session`.

* Valor: {Object} 
  * `effectiveLocalWindowSize` {number} The current local (receive) flow control window size for the `Http2Session`.
  * `effectiveRecvDataLength` {number} The current number of bytes that have been received since the last flow control `WINDOW_UPDATE`.
  * `nextStreamID` {number} The numeric identifier to be used the next time a new `Http2Stream` is created by this `Http2Session`.
  * `localWindowSize` {number} The number of bytes that the remote peer can send without receiving a `WINDOW_UPDATE`.
  * `lastProcStreamID` {number} The numeric id of the `Http2Stream` for which a `HEADERS` or `DATA` frame was most recently received.
  * `remoteWindowSize` {number} The number of bytes that this `Http2Session` may send without receiving a `WINDOW_UPDATE`.
  * `outboundQueueSize` {number} The number of frames currently within the outbound queue for this `Http2Session`.
  * `deflateDynamicTableSize` {number} The current size in bytes of the outbound header compression state table.
  * `inflateDynamicTableSize` {number} The current size in bytes of the inbound header compression state table.

Un objeto que describe el estado actual de este `Http2Session`.

#### http2session.settings(settings)

<!-- YAML
added: v8.4.0
-->

* `settings` {HTTP/2 Settings Object}

Updates the current local settings for this `Http2Session` and sends a new `SETTINGS` frame to the connected HTTP/2 peer.

Once called, the `http2session.pendingSettingsAck` property will be `true` while the session is waiting for the remote peer to acknowledge the new settings.

*Note*: The new settings will not become effective until the `SETTINGS` acknowledgment is received and the `'localSettings'` event is emitted. It is possible to send multiple `SETTINGS` frames while acknowledgment is still pending.

#### http2session.type

<!-- YAML
added: v8.4.0
-->

* Valor: {number}

The `http2session.type` will be equal to `http2.constants.NGHTTP2_SESSION_SERVER` if this `Http2Session` instance is a server, and `http2.constants.NGHTTP2_SESSION_CLIENT` if the instance is a client.

#### http2session.unref()

<!-- YAML
added: v8.11.2
-->

Calls [`unref()`][`net.Socket.prototype.unref`] on this `Http2Session` instance's underlying [`net.Socket`].

### Clase: ServerHttp2Session

<!-- YAML
added: v8.4.0
-->

#### serverhttp2session.altsvc(alt, originOrStream)

<!-- YAML
added: v8.11.2
-->

* `alt` {string} A description of the alternative service configuration as defined by [RFC 7838](https://tools.ietf.org/html/rfc7838).
* `originOrStream` {number|string|URL|Object} Either a URL string specifying the origin (or an Object with an `origin` property) or the numeric identifier of an active `Http2Stream` as given by the `http2stream.id` property.

Manda un frame `ALTSVC` (como lo define [RFC 7838](https://tools.ietf.org/html/rfc7838)) al cliente conectado.

```js
const http2 = require('http2');

const server = http2.createServer();
server.on('session', (session) => {
  // Establece altsvc para el origen https://example.org:80
  session.altsvc('h2=":8000"', 'https://example.org:80');
});

server.on('stream', (stream) => {
  // Establece altsvc para un stream específico
  stream.session.altsvc('h2=":8000"', stream.id);
});
```

Sending an `ALTSVC` frame with a specific stream ID indicates that the alternate service is associated with the origin of the given `Http2Stream`.

El `alt` y la string de origen *deben* contener solamente bytes ASCII, y se interpretan estrictamente como una secuencia de bytes ASCII. The special value `'clear'` may be passed to clear any previously set alternative service for a given domain.

When a string is passed for the `originOrStream` argument, it will be parsed as a URL and the origin will be derived. For instance, the origin for the HTTP URL `'https://example.org/foo/bar'` is the ASCII string `'https://example.org'`. An error will be thrown if either the given string cannot be parsed as a URL or if a valid origin cannot be derived.

A `URL` object, or any object with an `origin` property, may be passed as `originOrStream`, in which case the value of the `origin` property will be used. El valor de la propiedad `origin` *debe* ser un origen ASCII serializado de manera apropiada.

#### Especificación de servicios alternativos

The format of the `alt` parameter is strictly defined by [RFC 7838](https://tools.ietf.org/html/rfc7838) as an ASCII string containing a comma-delimited list of "alternative" protocols associated with a specific host and port.

For example, the value `'h2="example.org:81"'` indicates that the HTTP/2 protocol is available on the host `'example.org'` on TCP/IP port 81. El host y el puerto *deben* estar contenidos dentro de los caracteres de (`"`) comillas.

Se pueden especificar múltiples alternativas, por ejemplo: `'h2="example.org:81",
h2=":82"'`

The protocol identifier (`'h2'` in the examples) may be any valid [ALPN Protocol ID](https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids).

The syntax of these values is not validated by the Node.js implementation and are passed through as provided by the user or received from the peer.

#### serverhttp2session.origin(...origins)

<!-- YAML
added: v8.13.0
-->

* `origins` { string | URL | Object } One or more URL Strings passed as separate arguments.

Submits an `ORIGIN` frame (as defined by [RFC 8336](https://tools.ietf.org/html/rfc8336)) to the connected client to advertise the set of origins for which the server is capable of providing authoritative responses.

```js
const http2 = require('http2');
const options = getSecureOptionsSomehow();
const server = http2.createSecureServer(options);
server.on('stream', (stream) => {
  stream.respond();
  stream.end('ok');
});
server.on('session', (session) => {
  session.origin('https://example.com', 'https://example.org');
});
```

When a string is passed as an `origin`, it will be parsed as a URL and the origin will be derived. For instance, the origin for the HTTP URL `'https://example.org/foo/bar'` is the ASCII string `'https://example.org'`. An error will be thrown if either the given string cannot be parsed as a URL or if a valid origin cannot be derived.

A `URL` object, or any object with an `origin` property, may be passed as an `origin`, in which case the value of the `origin` property will be used. El valor de la propiedad `origin` *debe* ser un origen ASCII serializado de manera apropiada.

Alternatively, the `origins` option may be used when creating a new HTTP/2 server using the `http2.createSecureServer()` method:

```js
const http2 = require('http2');
const options = getSecureOptionsSomehow();
options.origins = ['https://example.com', 'https://example.org'];
const server = http2.createSecureServer(options);
server.on('stream', (stream) => {
  stream.respond();
  stream.end('ok');
});
```

### Clase: ClientHttp2Session

<!-- YAML
added: v8.4.0
-->

#### Evento: 'altsvc'

<!-- YAML
added: v8.11.2
-->

* `alt` {string}
* `origin` {string}
* `streamId` {number}

The `'altsvc'` event is emitted whenever an `ALTSVC` frame is received by the client. The event is emitted with the `ALTSVC` value, origin, and stream ID. If no `origin` is provided in the `ALTSVC` frame, `origin` will be an empty string.

```js
const http2 = require('http2');
const client = http2.connect('https://example.org');

client.on('altsvc', (alt, origin, streamId) => {
  console.log(alt);
  console.log(origin);
  console.log(streamId);
});
```

#### Event: 'origin'

<!-- YAML
added: v8.13.0
-->

* `origins` {string[]}

El evento `'origin'` es emitido cada vez que un frame `ORIGIN` es recibido por el cliente. The event is emitted with an array of `origin` strings. The `http2session.originSet` will be updated to include the received origins.

```js
const http2 = require('http2');
const client = http2.connect('https://example.org');

client.on('origin', (origins) => {
  for (let n = 0; n < origins.length; n++)
    console.log(origins[n]);
});
```

The `'origin'` event is only emitted when using a secure TLS connection.

#### clienthttp2session.request(headers[, options])

<!-- YAML
added: v8.4.0
-->

* `headers` {HTTP/2 Headers Object}
* `opciones` {Object}
  
  * `endStream` {boolean} `true` si el lado `Http2Stream` *writable* debe ser cerrado inicialmente, como cuando se envía una solicitud `GET` que no debe esperar un cuerpo payload.
  * `exclusive` {boolean} When `true` and `parent` identifies a parent Stream, the created stream is made the sole direct dependency of the parent, with all other existing dependents made a dependent of the newly created stream. **Predeterminado:** `false`.
  * `parent` {number} Specifies the numeric identifier of a stream the newly created stream is dependent on.
  * `weight` {number} Specifies the relative dependency of a stream in relation to other streams with the same `parent`. The value is a number between `1` and `256` (inclusive).
  * `waitForTrailers` {boolean} When `true`, the `Http2Stream` will emit the `'wantTrailers'` event after the final `DATA` frame has been sent.

* Devuelve: {ClientHttp2Stream}

For HTTP/2 Client `Http2Session` instances only, the `http2session.request()` creates and returns an `Http2Stream` instance that can be used to send an HTTP/2 request to the connected server.

This method is only available if `http2session.type` is equal to `http2.constants.NGHTTP2_SESSION_CLIENT`.

```js
const http2 = require('http2');
const clientSession = http2.connect('https://localhost:1234');
const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS
} = http2.constants;

const req = clientSession.request({ [HTTP2_HEADER_PATH]: '/' });
req.on('response', (headers) => {
  console.log(headers[HTTP2_HEADER_STATUS]);
  req.on('data', (chunk) => { /** .. **/ });
  req.on('end', () => { /** .. **/ });
});
```

When the `options.waitForTrailers` option is set, the `'wantTrailers'` event is emitted immediately after queuing the last chunk of payload data to be sent. The `http2stream.sendTrailers()` method can then be called to send trailing headers to the peer.

When `options.waitForTrailers` is set, the `Http2Stream` will not automatically close when the final `DATA` frame is transmitted. User code must call either `http2stream.sendTrailers()` or `http2stream.close()` to close the `Http2Stream`.

The `:method` and `:path` pseudo-headers are not specified within `headers`, they respectively default to:

* `:method` = `'GET'`
* `:path` = `/`

### Clase: Http2Stream

<!-- YAML
added: v8.4.0
-->

* Extiende a: {stream.Duplex}

Each instance of the `Http2Stream` class represents a bidirectional HTTP/2 communications stream over an `Http2Session` instance. Any single `Http2Session` may have up to 2<sup>31</sup>-1 `Http2Stream` instances over its lifetime.

Código de usuario no construirá instancias de `Http2Stream` directamente. Rather, these are created, managed, and provided to user code through the `Http2Session` instance. On the server, `Http2Stream` instances are created either in response to an incoming HTTP request (and handed off to user code via the `'stream'` event), or in response to a call to the `http2stream.pushStream()` method. On the client, `Http2Stream` instances are created and returned when either the `http2session.request()` method is called, or in response to an incoming `'push'` event.

*Note*: The `Http2Stream` class is a base for the [`ServerHttp2Stream`][] and [`ClientHttp2Stream`][] classes, each of which is used specifically by either the Server or Client side, respectively.

Todas las instancias de `Http2Stream` son streams de [`Duplex`][]. The `Writable` side of the `Duplex` is used to send data to the connected peer, while the `Readable` side is used to receive data sent by the connected peer.

#### Ciclo de vida de Http2Stream

##### Creación

On the server side, instances of [`ServerHttp2Stream`][] are created either when:

* Se recibe un frame nuevo de HTTP/2 `HEADERS` con ID de un stream no utilizado previamente;
* El método `http2stream.pushStream()` es llamado.

On the client side, instances of [`ClientHttp2Stream`][] are created when the `http2session.request()` method is called.

*Note*: On the client, the `Http2Stream` instance returned by `http2session.request()` may not be immediately ready for use if the parent `Http2Session` has not yet been fully established. In such cases, operations called on the `Http2Stream` will be buffered until the `'ready'` event is emitted. User code should rarely, if ever, need to handle the `'ready'` event directly. The ready status of an `Http2Stream` can be determined by checking the value of `http2stream.id`. If the value is `undefined`, the stream is not yet ready for use.

##### Destrucción

Todas las instancias de [`Http2Stream`][] se destruyen ya sea cuando:

* Un frame de `RST_STREAM` para el stream es recibido por el peer conectado.
* El método de `http2stream.close()` es llamado.
* Los métodos de `http2stream.destroy()` o `http2session.destroy()` son llamados.

Cuando se destruye una instancia `Http2Stream`, se hará un intento de enviar un frame `RST_STREAM` al peer conectado.

When the `Http2Stream` instance is destroyed, the `'close'` event will be emitted. Because `Http2Stream` is an instance of `stream.Duplex`, the `'end'` event will also be emitted if the stream data is currently flowing. The `'error'` event may also be emitted if `http2stream.destroy()` was called with an `Error` passed as the first argument.

After the `Http2Stream` has been destroyed, the `http2stream.destroyed` property will be `true` and the `http2stream.rstCode` property will specify the `RST_STREAM` error code. The `Http2Stream` instance is no longer usable once destroyed.

#### Evento: 'aborted'

<!-- YAML
added: v8.4.0
-->

The `'aborted'` event is emitted whenever a `Http2Stream` instance is abnormally aborted in mid-communication.

*Note*: The `'aborted'` event will only be emitted if the `Http2Stream` writable side has not been ended.

#### Evento: 'close'

<!-- YAML
added: v8.4.0
-->

El evento de `'close'` se emite cuando se destruye el `Http2Stream` . Once this event is emitted, the `Http2Stream` instance is no longer usable.

The listener callback is passed a single argument specifying the HTTP/2 error code specified when closing the stream. If the code is any value other than `NGHTTP2_NO_ERROR` (`0`), an `'error'` event will also be emitted.

#### Evento: 'error'

<!-- YAML
added: v8.4.0
-->

* `error` {Error}

The `'error'` event is emitted when an error occurs during the processing of an `Http2Stream`.

#### Evento: 'frameError'

<!-- YAML
added: v8.4.0
-->

The `'frameError'` event is emitted when an error occurs while attempting to send a frame. When invoked, the handler function will receive an integer argument identifying the frame type, and an integer argument identifying the error code. The `Http2Stream` instance will be destroyed immediately after the `'frameError'` event is emitted.

#### Evento: 'timeout'

<!-- YAML
added: v8.4.0
-->

The `'timeout'` event is emitted after no activity is received for this `'Http2Stream'` within the number of milliseconds set using `http2stream.setTimeout()`.

#### Evento: 'trailers'

<!-- YAML
added: v8.4.0
-->

The `'trailers'` event is emitted when a block of headers associated with trailing header fields is received. The listener callback is passed the [HTTP/2 Headers Object](#http2_headers_object) and flags associated with the headers.

Tenga en cuenta que este evento podría no emitirse si se llama a ` http2stream.end()` antes de recibir los trailers y no se están leyendo ni escuchando los datos entrantes.

```js
stream.on('trailers', (headers, flags) => {
  console.log(headers);
});
```

#### Evento: 'wantTrailers'

<!-- YAML
added: v8.13.0
-->

The `'wantTrailers'` event is emitted when the `Http2Stream` has queued the final `DATA` frame to be sent on a frame and the `Http2Stream` is ready to send trailing headers. When initiating a request or response, the `waitForTrailers` option must be set for this event to be emitted.

#### http2stream.aborted

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Se establece a `true` si la instancia de `Http2Stream` fue abortada de manera anormal. When set, the `'aborted'` event will have been emitted.

#### http2stream.close(code[, callback])

<!-- YAML
added: v8.4.0
-->

* code {number} Entero de 32 bits no firmado que identifica el código de error. **Default:** `http2.constants.NGHTTP2_NO_ERROR` (`0x00`).
* `callback` {Function} An optional function registered to listen for the `'close'` event.
* Devuelve: {undefined}

Closes the `Http2Stream` instance by sending an `RST_STREAM` frame to the connected HTTP/2 peer.

#### http2stream.closed

<!-- YAML
added: v8.11.2
-->

* Valor: {boolean}

Establecida para `true` si la instancia `Http2Stream` ha sido cerrada.

#### http2stream.destroyed

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Set to `true` if the `Http2Stream` instance has been destroyed and is no longer usable.

#### http2stream.endAfterHeaders

<!-- YAML
added: v8.13.0
-->

* {boolean}

Set the `true` if the `END_STREAM` flag was set in the request or response HEADERS frame received, indicating that no additional data should be received and the readable side of the `Http2Stream` will be closed.

#### http2stream.pending

<!-- YAML
added: v8.11.2
-->

* Valor: {boolean}

Set to `true` if the `Http2Stream` instance has not yet been assigned a numeric stream identifier.

#### http2stream.priority(options)

<!-- YAML
added: v8.4.0
-->

* `options` {Object} 
  * `exclusive` {boolean} When `true` and `parent` identifies a parent Stream, this stream is made the sole direct dependency of the parent, with all other existing dependents made a dependent of this stream. **Predeterminado:** `false`.
  * `parent` {number} Specifies the numeric identifier of a stream this stream is dependent on.
  * `weight` {number} Specifies the relative dependency of a stream in relation to other streams with the same `parent`. The value is a number between `1` and `256` (inclusive).
  * `silent` {boolean} When `true`, changes the priority locally without sending a `PRIORITY` frame to the connected peer.
* Devuelve: {undefined}

Actualiza la prioridad para esta instancia `Http2Stream` .

#### http2stream.rstCode

<!-- YAML
added: v8.4.0
-->

* Valor: {number}

Set to the `RST_STREAM` [error code](#error_codes) reported when the `Http2Stream` is destroyed after either receiving an `RST_STREAM` frame from the connected peer, calling `http2stream.close()`, or `http2stream.destroy()`. Will be `undefined` if the `Http2Stream` has not been closed.

#### http2stream.sentHeaders

<!-- YAML
added: v8.11.2
-->

* Value: {HTTP/2 Headers Object}

Un objeto que contiene las cabeceras salientes enviadas para este `Http2Stream`.

#### http2stream.sentInfoHeaders

<!-- YAML
added: v8.11.2
-->

* Value: {HTTP/2 Headers Object[]}

An array of objects containing the outbound informational (additional) headers sent for this `Http2Stream`.

#### http2stream.sentTrailers

<!-- YAML
added: v8.11.2
-->

* Value: {HTTP/2 Headers Object}

Un objeto que contiene los trailers salientes enviados para este `HttpStream`.

#### http2stream.session

<!-- YAML
added: v8.4.0
-->

* Valor: {Http2Session}

Una referencia a la instancia de `Http2Session` que posee este `Http2Stream`. The value will be `undefined` after the `Http2Stream` instance is destroyed.

#### http2stream.setTimeout(msecs, callback)

<!-- YAML
added: v8.4.0
-->

* `msecs` {number}
* `callback` {Function}
* Devuelve: {undefined}

```js
const http2 = require('http2');
const client = http2.connect('http://example.org:8000');
const { NGHTTP2_CANCEL } = http2.constants;
const req = client.request({ ':path': '/' });

// Cancel the stream if there's no activity after 5 seconds
req.setTimeout(5000, () => req.close(NGHTTP2_CANCEL));
```

#### http2stream.state

<!-- YAML
added: v8.4.0
--> Provides miscellaneous information about the current state of the 

`Http2Stream`.

* Valor: {Object} 
  * `localWindowSize` {number} The number of bytes the connected peer may send for this `Http2Stream` without receiving a `WINDOW_UPDATE`.
  * `state` {number} A flag indicating the low-level current state of the `Http2Stream` as determined by nghttp2.
  * `localClose` {number} es `true` en caso de que este `Http2Stream` haya sido cerrado de manera local.
  * `remoteClose` {number} `true` si este `Http2Stream` ha sido cerrado de manera remota.
  * `sumDependencyWeight` {number} The sum weight of all `Http2Stream` instances that depend on this `Http2Stream` as specified using `PRIORITY` frames.
  * `weight` {number} El peso de prioridad de esta `Http2Stream`.

Un estado actual de este `Http2Stream`.

#### http2stream.sendTrailers(headers)

<!-- YAML
added: v8.13.0
-->

* `headers` {HTTP/2 Headers Object}

Envía un frame final `HEADERS` al par HTTP / 2 conectado. Este método causará que el `Http2Stream` se cierre inmediatamente, y solo debe ser llamado luego de que el evento de `'wantTrailers'` haya sido emitido. When sending a request or sending a response, the `options.waitForTrailers` option must be set in order to keep the `Http2Stream` open after the final `DATA` frame so that trailers can be sent.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  stream.respond(undefined, { waitForTrailers: true });
  stream.on('wantTrailers', () => {
    stream.sendTrailers({ xyz: 'abc' });
  });
  stream.end('Hello World');
});
```

The HTTP/1 specification forbids trailers from containing HTTP/2 pseudo-header fields (e.g. `':method'`, `':path'`, etc).

### Clase: ClientHttp2Stream

<!-- YAML
added: v8.4.0
-->

* Extiende a {Http2Stream}

The `ClientHttp2Stream` class is an extension of `Http2Stream` that is used exclusively on HTTP/2 Clients. `Http2Stream` instances on the client provide events such as `'response'` and `'push'` that are only relevant on the client.

#### Evento: 'continue'

<!-- YAML
added: v8.5.0
-->

Emitted when the server sends a `100 Continue` status, usually because the request contained `Expect: 100-continue`. Esta es una instrucción en la cual el cliente debería enviar el cuerpo de la solicitud.

#### Evento: 'headers'

<!-- YAML
added: v8.4.0
-->

The `'headers'` event is emitted when an additional block of headers is received for a stream, such as when a block of `1xx` informational headers is received. The listener callback is passed the [HTTP/2 Headers Object](#http2_headers_object) and flags associated with the headers.

```js
stream.on('headers', (headers, flags) => {
  console.log(headers);
});
```

#### Evento: 'push'

<!-- YAML
added: v8.4.0
-->

The `'push'` event is emitted when response headers for a Server Push stream are received. The listener callback is passed the [HTTP/2 Headers Object](#http2_headers_object) and flags associated with the headers.

```js
stream.on('push', (headers, flags) => {
  console.log(headers);
});
```

#### Evento: 'response'

<!-- YAML
added: v8.4.0
-->

The `'response'` event is emitted when a response `HEADERS` frame has been received for this stream from the connected HTTP/2 server. The listener is invoked with two arguments: an Object containing the received [HTTP/2 Headers Object](#http2_headers_object), and flags associated with the headers.

Por ejemplo:

```js
const http2 = require('http2');
const client = http2.connect('https://localhost');
const req = client.request({ ':path': '/' });
req.on('response', (headers, flags) => {
  console.log(headers[':status']);
});
```

### Clase: ServerHttp2Stream

<!-- YAML
added: v8.4.0
-->

* Extiende a: {Http2Stream}

The `ServerHttp2Stream` class is an extension of [`Http2Stream`][] that is used exclusively on HTTP/2 Servers. `Http2Stream` instances on the server provide additional methods such as `http2stream.pushStream()` and `http2stream.respond()` that are only relevant on the server.

#### http2stream.additionalHeaders(headers)

<!-- YAML
added: v8.4.0
-->

* `headers` {HTTP/2 Headers Object}

Envía un frame adicional e informativo de `HEADERS` al peer conectado de HTTP/2.

#### http2stream.headersSent

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Booleano (solo-lectura). Verdadero si las cabeceras fueron enviadas, de lo contrario falso.

#### http2stream.pushAllowed

<!-- YAML
added: v8.4.0
-->

* Valor: {boolean}

Read-only property mapped to the `SETTINGS_ENABLE_PUSH` flag of the remote client's most recent `SETTINGS` frame. Will be `true` if the remote peer accepts push streams, `false` otherwise. Settings are the same for every `Http2Stream` in the same `Http2Session`.

#### http2stream.pushStream(headers[, options], callback)

<!-- YAML
added: v8.4.0
-->

* `headers` {HTTP/2 Headers Object}
* `options` {Object} 
  * `exclusive` {boolean} When `true` and `parent` identifies a parent Stream, the created stream is made the sole direct dependency of the parent, with all other existing dependents made a dependent of the newly created stream. **Predeterminado:** `false`.
  * `parent` {number} Specifies the numeric identifier of a stream the newly created stream is dependent on.
* `callback` {Function} Callback que es llamada una vez que el push stream ha sido iniciado. 
  * `err` {Error}
  * `pushStream` {ServerHttp2Stream} The returned pushStream object.
  * `headers` {HTTP/2 Headers Object} Headers object the pushStream was initiated with.
* Devuelve: {undefined}

Inicia un push stream. The callback is invoked with the new `Http2Stream` instance created for the push stream passed as the second argument, or an `Error` passed as the first argument.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  stream.respond({ ':status': 200 });
  stream.pushStream({ ':path': '/' }, (err, pushStream, headers) => {
    if (err) throw err;
    pushStream.respond({ ':status': 200 });
    pushStream.end('some pushed data');
  });
  stream.end('some data');
});
```

No se permite establecer el peso de un push stream en el frame `HEADERS`. Pass a `weight` value to `http2stream.priority` with the `silent` option set to `true` to enable server-side bandwidth balancing between concurrent streams.

Calling `http2stream.pushStream()` from within a pushed stream is not permitted and will throw an error.

#### http2stream.respond([headers[, options]])

<!-- YAML
added: v8.4.0
-->

* `headers` {HTTP/2 Headers Object}
* `options` {Object} 
  * `endStream` {boolean} Set to `true` to indicate that the response will not include payload data.
  * `waitForTrailers` {boolean} When `true`, the `Http2Stream` will emit the `'wantTrailers'` event after the final `DATA` frame has been sent.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  stream.respond({ ':status': 200 });
  stream.end('some data');
});
```

When the `options.waitForTrailers` option is set, the `'wantTrailers'` event will be emitted immediately after queuing the last chunk of payload data to be sent. The `http2stream.sendTrailers()` method can then be used to sent trailing header fields to the peer.

When `options.waitForTrailers` is set, the `Http2Stream` will not automatically close when the final `DATA` frame is transmitted. User code must call either `http2stream.sendTrailers()` or `http2stream.close()` to close the `Http2Stream`.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  stream.respond({ ':status': 200 }, { waitForTrailers: true });
  stream.on('wantTrailers', () => {
    stream.sendTrailers({ ABC: 'some value to send' });
  });
  stream.end('some data');
});
```

#### http2stream.respondWithFD(fd[, headers[, options]])

<!-- YAML
added: v8.4.0
-->

* `fd` {number} Un descriptor de archivo legible.
* `headers` {HTTP/2 Headers Object}
* `options` {Object} 
  * `statCheck` {Function}
  * `waitForTrailers` {boolean} When `true`, the `Http2Stream` will emit the `'wantTrailers'` event after the final `DATA` frame has been sent.
  * `offset` {number} The offset position at which to begin reading.
  * `length` {number} La cantidad de datos de la fd a enviar.

Inicia una respuesta cuyos datos son leídos desde el descriptor de archivo dado. No validation is performed on the given file descriptor. If an error occurs while attempting to read data using the file descriptor, the `Http2Stream` will be closed using an `RST_STREAM` frame using the standard `INTERNAL_ERROR` code.

When used, the `Http2Stream` object's Duplex interface will be closed automatically.

```js
const http2 = require('http2');
const fs = require('fs');

const server = http2.createServer();
server.on('stream', (stream) => {
  const fd = fs.openSync('/some/file', 'r');

  const stat = fs.fstatSync(fd);
  const headers = {
    'content-length': stat.size,
    'last-modified': stat.mtime.toUTCString(),
    'content-type': 'text/plain'
  };
  stream.respondWithFD(fd, headers);
  stream.on('close', () => fs.closeSync(fd));
});
```

The optional `options.statCheck` function may be specified to give user code an opportunity to set additional content headers based on the `fs.Stat` details of the given fd. If the `statCheck` function is provided, the `http2stream.respondWithFD()` method will perform an `fs.fstat()` call to collect details on the provided file descriptor.

The `offset` and `length` options may be used to limit the response to a specific range subset. This can be used, for instance, to support HTTP Range requests.

El descriptor de archivos no se cierra cuando se cierra el stream, entonces necesitará cerrarse manualmente una vez que ya no se necesite. Tenga en cuenta que utilizar el mismo descriptor de archivo de manera concurrente para múltiples streams no es soportado y puede resultar en pérdida de datos. Re-using a file descriptor after a stream has finished is supported.

When the `options.waitForTrailers` option is set, the `'wantTrailers'` event will be emitted immediately after queuing the last chunk of payload data to be sent. The `http2stream.sendTrailers()` method can then be used to sent trailing header fields to the peer.

When `options.waitForTrailers` is set, the `Http2Stream` will not automatically close when the final `DATA` frame is transmitted. El código de usuario *debe* llamar a `http2stream.sendTrailers()` o a `http2stream.close()` para cerrar el `Http2Stream`.

```js
const http2 = require('http2');
const fs = require('fs');

const server = http2.createServer();
server.on('stream', (stream) => {
  const fd = fs.openSync('/some/file', 'r');

  const stat = fs.fstatSync(fd);
  const headers = {
    'content-length': stat.size,
    'last-modified': stat.mtime.toUTCString(),
    'content-type': 'text/plain'
  };
  stream.respondWithFD(fd, headers, { waitForTrailers: true });
  stream.on('wantTrailers', () => {
    stream.sendTrailers({ ABC: 'some value to send' });
  });

  stream.on('close', () => fs.closeSync(fd));
});
```

#### http2stream.respondWithFile(path[, headers[, options]])

<!-- YAML
added: v8.4.0
-->

* `path`{string|Buffer|URL}
* `headers` {HTTP/2 Headers Object}
* `opciones` {Object} 
  * `statCheck` {Function}
  * `onError` {Function} Callback function invoked in the case of an Error before send.
  * `waitForTrailers` {boolean} When `true`, the `Http2Stream` will emit the `'wantTrailers'` event after the final `DATA` frame has been sent.
  * `offset` {number} The offset position at which to begin reading.
  * `length` {number} La cantidad de datos de la fd a enviar.

Envía un archivo normal como respuesta. The `path` must specify a regular file or an `'error'` event will be emitted on the `Http2Stream` object.

When used, the `Http2Stream` object's Duplex interface will be closed automatically.

The optional `options.statCheck` function may be specified to give user code an opportunity to set additional content headers based on the `fs.Stat` details of the given file:

If an error occurs while attempting to read the file data, the `Http2Stream` will be closed using an `RST_STREAM` frame using the standard `INTERNAL_ERROR` code. Si se define el callback de `onError`, entonces será llamado. Otherwise the stream will be destroyed.

Ejemplo utilizando una ruta de archivo:

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  function statCheck(stat, headers) {
    headers['last-modified'] = stat.mtime.toUTCString();
  }

  function onError(err) {
    if (err.code === 'ENOENT') {
      stream.respond({ ':status': 404 });
    } else {
      stream.respond({ ':status': 500 });
    }
    stream.end();
  }

  stream.respondWithFile('/some/file',
                         { 'content-type': 'text/plain' },
                         { statCheck, onError });
});
```

The `options.statCheck` function may also be used to cancel the send operation by returning `false`. For instance, a conditional request may check the stat results to determine if the file has been modified to return an appropriate `304` response:

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  function statCheck(stat, headers) {
    // Check the stat here...
    stream.respond({ ':status': 304 });
    return false; // Cancel the send operation
  }
  stream.respondWithFile('/some/file',
                         { 'content-type': 'text/plain' },
                         { statCheck });
});
```

El campo de encabezado `content-length` se establecerá automáticamente.

The `offset` and `length` options may be used to limit the response to a specific range subset. This can be used, for instance, to support HTTP Range requests.

The `options.onError` function may also be used to handle all the errors that could happen before the delivery of the file is initiated. The default behavior is to destroy the stream.

When the `options.waitForTrailers` option is set, the `'wantTrailers'` event will be emitted immediately after queuing the last chunk of payload data to be sent. The `http2stream.sendTrilers()` method can then be used to sent trailing header fields to the peer.

When `options.waitForTrailers` is set, the `Http2Stream` will not automatically close when the final `DATA` frame is transmitted. User code must call either `http2stream.sendTrailers()` or `http2stream.close()` to close the `Http2Stream`.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream) => {
  stream.respondWithFile('/some/file',
                         { 'content-type': 'text/plain' },
                         { waitForTrailers: true });
  stream.on('wantTrailers', () => {
    stream.sendTrailers({ ABC: 'some value to send' });
  });
});
```

### Clase: Http2Server

<!-- YAML
added: v8.4.0
-->

* Extiende a: {net.Server}

Instances of `Http2Server` are created using the `http2.createServer()` function. The `Http2Server` class is not exported directly by the `http2` module.

#### Evento: 'checkContinue'

<!-- YAML
added: v8.5.0
-->

* `request` {http2.Http2ServerRequest}
* `response` {http2.Http2ServerResponse}

If a [`'request'`][] listener is registered or [`http2.createServer()`][] is supplied a callback function, the `'checkContinue'` event is emitted each time a request with an HTTP `Expect: 100-continue` is received. If this event is not listened for, the server will automatically respond with a status `100 Continue` as appropriate.

Manejar este evento implica llamar a [`response.writeContinue()`][] si el cliente fuese a continuar enviando el cuerpo de la solicitud, o a generar una respuesta de HTTP apropiada (por ejemplo, 400 Bad Request) si el cliente no fuese a continuar enviando el cuerpo de la solicitud.

Tenga en cuenta que cuando este evento sea emitido y manejado, el evento [`'request'`][] no será emitido.

#### Evento: 'request'

<!-- YAML
added: v8.4.0
-->

* `request` {http2.Http2ServerRequest}
* `response` {http2.Http2ServerResponse}

Se emite cada vez que hay una solicitud. Tenga en cuenta que pueden haber múltiples solicitudes por sesión. Vea la [Compatibility API](#http2_compatibility_api).

#### Evento: 'session'

<!-- YAML
added: v8.4.0
-->

The `'session'` event is emitted when a new `Http2Session` is created by the `Http2Server`.

#### Evento: 'sessionError'

<!-- YAML
added: v8.4.0
-->

The `'sessionError'` event is emitted when an `'error'` event is emitted by an `Http2Session` object associated with the `Http2Server`.

#### Evento: 'stream'

<!-- YAML
added: v8.4.0
-->

The `'stream'` event is emitted when a `'stream'` event has been emitted by an `Http2Session` associated with the server.

```js
const http2 = require('http2');
const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_TYPE
} = http2.constants;

const server = http2.createServer();
server.on('stream', (stream, headers, flags) => {
  const method = headers[HTTP2_HEADER_METHOD];
  const path = headers[HTTP2_HEADER_PATH];
  // ...
  stream.respond({
    [HTTP2_HEADER_STATUS]: 200,
    [HTTP2_HEADER_CONTENT_TYPE]: 'text/plain'
  });
  stream.write('hello ');
  stream.end('world');
});
```

#### Evento: 'timeout'

<!-- YAML
added: v8.4.0
-->

The `'timeout'` event is emitted when there is no activity on the Server for a given number of milliseconds set using `http2server.setTimeout()`. **Default:** 2 minutos.

#### server.close([callback])

<!-- YAML
added: v8.4.0
-->

* `callback` {Function}

No permite que el servidor acepte nuevas conexiones. Vea [`net.Server.close()`][].

Ten en cuenta que esto no es análogo a restringir nuevas peticiones ya que las conexiones HTTP/2 son persistentes. Para lograr un comportamiento similar de cierre elegante, considere también usar [`http2session.close()`] en sesiones activas.

#### server.setTimeout(\[msecs\]\[, callback\])

<!-- YAML
added: v8.4.0
-->

* `msecs` {number} **Predeterminado:** `120000` (2 minutos)
* `callback` {Function}
* Devuelve: {Http2Server}

Used to set the timeout value for http2 server requests, and sets a callback function that is called when there is no activity on the `Http2Server` after `msecs` milliseconds.

El callback dado, está registrado como un oyente en el evento `'timeout'`.

In case of no callback function were assigned, a new `ERR_INVALID_CALLBACK` error will be thrown.

### Clase: Http2SecureServer

<!-- YAML
added: v8.4.0
-->

* Extiende a: {tls.Server}

Instances of `Http2SecureServer` are created using the `http2.createSecureServer()` function. The `Http2SecureServer` class is not exported directly by the `http2` module.

#### Evento: 'checkContinue'

<!-- YAML
added: v8.5.0
-->

* `request` {http2.Http2ServerRequest}
* `response` {http2.Http2ServerResponse}

If a [`'request'`][] listener is registered or [`http2.createSecureServer()`][] is supplied a callback function, the `'checkContinue'` event is emitted each time a request with an HTTP `Expect: 100-continue` is received. If this event is not listened for, the server will automatically respond with a status `100 Continue` as appropriate.

Manejar este evento implica llamar a [`response.writeContinue()`][] si el cliente fuese a continuar enviando el cuerpo de la solicitud, o a generar una respuesta de HTTP apropiada (por ejemplo, 400 Bad Request) si el cliente no fuese a continuar enviando el cuerpo de la solicitud.

Tenga en cuenta que cuando este evento sea emitido y manejado, el evento [`'request'`][] no será emitido.

#### Evento: 'request'

<!-- YAML
added: v8.4.0
-->

* `request` {http2.Http2ServerRequest}
* `response` {http2.Http2ServerResponse}

Se emite cada vez que hay una solicitud. Tenga en cuenta que pueden haber múltiples solicitudes por sesión. Vea la [Compatibility API](#http2_compatibility_api).

#### Evento: 'session'

<!-- YAML
added: v8.4.0
-->

The `'session'` event is emitted when a new `Http2Session` is created by the `Http2SecureServer`.

#### Evento: 'sessionError'

<!-- YAML
added: v8.4.0
-->

The `'sessionError'` event is emitted when an `'error'` event is emitted by an `Http2Session` object associated with the `Http2SecureServer`.

#### Evento: 'stream'

<!-- YAML
added: v8.4.0
-->

The `'stream'` event is emitted when a `'stream'` event has been emitted by an `Http2Session` associated with the server.

```js
const http2 = require('http2');
const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_TYPE
} = http2.constants;

const options = getOptionsSomehow();

const server = http2.createSecureServer(options);
server.on('stream', (stream, headers, flags) => {
  const method = headers[HTTP2_HEADER_METHOD];
  const path = headers[HTTP2_HEADER_PATH];
  // ...
  stream.respond({
    [HTTP2_HEADER_STATUS]: 200,
    [HTTP2_HEADER_CONTENT_TYPE]: 'text/plain'
  });
  stream.write('hello ');
  stream.end('world');
});
```

#### Evento: 'timeout'

<!-- YAML
added: v8.4.0
-->

The `'timeout'` event is emitted when there is no activity on the Server for a given number of milliseconds set using `http2secureServer.setTimeout()`. **Default:** 2 minutos.

#### Evento: 'unknownProtocol'

<!-- YAML
added: v8.4.0
-->

The `'unknownProtocol'` event is emitted when a connecting client fails to negotiate an allowed protocol (i.e. HTTP/2 or HTTP/1.1). The event handler receives the socket for handling. If no listener is registered for this event, the connection is terminated. Vea la [Compatibility API](#http2_compatibility_api).

#### server.close([callback])

<!-- YAML
added: v8.4.0
-->

* `callback` {Function}

No permite que el servidor acepte nuevas conexiones. Vea [`tls.Server.close()`][].

Ten en cuenta que esto no es análogo a restringir nuevas peticiones ya que las conexiones HTTP/2 son persistentes. Para lograr un comportamiento similar de cierre elegante, considere también usar [`http2session.close()`] en sesiones activas.

#### server.setTimeout(\[msecs\]\[, callback\])

<!-- YAML
added: v8.4.0
-->

* `msecs` {number} **Predeterminado:** `120000` (2 minutos)
* `callback` {Function}
* Devuelve: {Http2SecureServer}

Used to set the timeout value for http2 secure server requests, and sets a callback function that is called when there is no activity on the `Http2SecureServer` after `msecs` milliseconds.

El callback dado, está registrado como un oyente en el evento `'timeout'`.

In case of no callback function were assigned, a new `ERR_INVALID_CALLBACK` error will be thrown.

### http2.createServer(options[, onRequestHandler])

<!-- YAML
added: v8.4.0
changes:

  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/17105
    description: Added the `maxOutstandingPings` option with a default limit of
                 10.
  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/16676
    description: Added the `maxHeaderListPairs` option with a default limit of
                 128 header pairs.
  - version: v8.12.0
    pr-url: https://github.com/nodejs/node/pull/15752
    description: Added the `Http1IncomingMessage` and `Http1ServerResponse`
                 option.
-->

* `options` {Object} 
  * `maxDeflateDynamicTableSize` {number} Sets the maximum dynamic table size for deflating header fields. **Predeterminado:** `4Kib`.
  * `maxSessionMemory`{number} Sets the maximum memory that the `Http2Session` is permitted to use. The value is expressed in terms of number of megabytes, e.g. `1` equal 1 megabyte. El valor mínimo permitido es `1`. This is a credit based limit, existing `Http2Stream`s may cause this limit to be exceeded, but new `Http2Stream` instances will be rejected while this limit is exceeded. The current number of `Http2Stream` sessions, the current memory use of the header compression tables, current data queued to be sent, and unacknowledged `PING` and `SETTINGS` frames are all counted towards the current limit. **Predeterminado:** `10`.
  * `maxHeaderListPairs` {number} Establece el número máximo de entradas de encabezado. El valor mínimo es `4`. **Predeterminado:** `128`.
  * `maxOutstandingPings` {number} Sets the maximum number of outstanding, unacknowledged pings. **Predeterminado:** `10`.
  * `maxSendHeaderBlockLength` {number} Sets the maximum allowed size for a serialized, compressed block of headers. Attempts to send headers that exceed this limit will result in a `'frameError'` event being emitted and the stream being closed and destroyed.
  * `paddingStrategy` {number} Identifica la estrategia utilizada para determinar la cantidad de relleno a usar para frames de `HEADERS` y `DATA` . **Predeterminado:** `http2.constants.PADDING_STRATEGY_NONE`. El valor puede ser uno de los siguientes: 
    * `http2.constants.PADDING_STRATEGY_NONE` - Especifica que no se deberá aplicar relleno.
    * `http2.constants.PADDING_STRATEGY_MAX` - Especifica que la cantidad máxima de relleno, según lo determinado por la implementación interna, deberá ser aplicada.
    * `http2.constants.PADDING_STRATEGY_CALLBACK` - Specifies that the user provided `options.selectPadding` callback is to be used to determine the amount of padding.
    * `http2.constants.PADDING_STRATEGY_ALIGNED` - *intentará* aplicar suficiente relleno para asegurar que la longitud total del frame, incluyendo el encabezado 9-byte, sea un múltiplo de 8. Sin embargo, para cada frame, hay un número máximo permitido de bytes de relleno que está determinado por el estado actual del control de flujo y las configuraciones. Si este valor máximo es inferior a la cantidad calculada necesaria para asegurar la alineación, el valor máximo será utilizado y la longitud total del frame *no* necesariamente estará alineada en 8 bytes.
  * `peerMaxConcurrentStreams` {number} Sets the maximum number of concurrent streams for the remote peer as if a `SETTINGS` frame had been received. Will be overridden if the remote peer sets its own value for `maxConcurrentStreams`. **Predeterminado:** `100`.
  * `selectPadding` {Function} When `options.paddingStrategy` is equal to `http2.constants.PADDING_STRATEGY_CALLBACK`, provides the callback function used to determine the padding. Vea [Utilización de options.selectPadding](#http2_using_options_selectpadding).
  * `settings` {HTTP/2 Settings Object} The initial settings to send to the remote peer upon connection.
  * `Http1IncomingMessage` {http.IncomingMessage} Specifies the IncomingMessage class to used for HTTP/1 fallback. Useful for extending the original `http.IncomingMessage`. **Default:** `http.IncomingMessage`.
  * `Http1ServerResponse` {http.ServerResponse} Specifies the ServerResponse class to used for HTTP/1 fallback. Useful for extending the original `http.ServerResponse`. **Default:** `http.ServerResponse`.
  * `Http2ServerRequest` {http2.Http2ServerRequest} Specifies the Http2ServerRequest class to use. Útil para extender el `Http2ServerRequest` original. **Default:** `Http2ServerRequest`.
  * `Http2ServerResponse` {http2.Http2ServerResponse} Specifies the Http2ServerResponse class to use. Útil para extender el `Http2ServerResponse` original. **Predeterminado:** `Http2ServerResponse`.
* `onRequestHandler` {Function} Vea [API de Compatibilidad](#http2_compatibility_api)
* Devuelve: {Http2Server}

Returns a `net.Server` instance that creates and manages `Http2Session` instances.

Since there are no browsers known that support [unencrypted HTTP/2](https://http2.github.io/faq/#does-http2-require-encryption), the use of [`http2.createSecureServer()`][] is necessary when communicating with browser clients.

```js
const http2 = require('http2');

// Create an unencrypted HTTP/2 server.
// Since there are no browsers known that support
// unencrypted HTTP/2, the use of `http2.createSecureServer()`
// is necessary when communicating with browser clients.
const server = http2.createServer();

server.on('stream', (stream, headers) => {
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  stream.end('<h1>Hello World</h1>');
});

server.listen(80);
```

### http2.createSecureServer(options[, onRequestHandler])

<!-- YAML
added: v8.4.0
changes:

  - version: v8.13.0
    pr-url: https://github.com/nodejs/node/pull/22956
    description: Added the `origins` option to automatically send an `ORIGIN`
                 frame on `Http2Session` startup.
  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/17105
    description: Added the `maxOutstandingPings` option with a default limit of
                 10.
  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/16676
    description: Added the `maxHeaderListPairs` option with a default limit of
                 128 header pairs.
-->

* `options` {Object} 
  * `allowHTTP1` {boolean} Incoming client connections that do not support HTTP/2 will be downgraded to HTTP/1.x when set to `true`. Vea el evento [`'unknownProtocol'`][] . Vea [ALPN negotiation](#http2_alpn_negotiation). **Predeterminado:** `false`.
  * `maxDeflateDynamicTableSize` {number} Sets the maximum dynamic table size for deflating header fields. **Predeterminado:** `4Kib`.
  * `maxSessionMemory`{number} Sets the maximum memory that the `Http2Session` is permitted to use. The value is expressed in terms of number of megabytes, e.g. `1` equal 1 megabyte. El valor mínimo permitido es `1`. This is a credit based limit, existing `Http2Stream`s may cause this limit to be exceeded, but new `Http2Stream` instances will be rejected while this limit is exceeded. The current number of `Http2Stream` sessions, the current memory use of the header compression tables, current data queued to be sent, and unacknowledged `PING` and `SETTINGS` frames are all counted towards the current limit. **Predeterminado:** `10`.
  * `maxHeaderListPairs` {number} Establece el número máximo de entradas de encabezado. El valor mínimo es `4`. **Predeterminado:** `128`.
  * `maxOutstandingPings` {number} Sets the maximum number of outstanding, unacknowledged pings. **Predeterminado:** `10`.
  * `maxSendHeaderBlockLength` {number} Sets the maximum allowed size for a serialized, compressed block of headers. Attempts to send headers that exceed this limit will result in a `'frameError'` event being emitted and the stream being closed and destroyed.
  * `paddingStrategy` {number} Identifica la estrategia utilizada para determinar la cantidad de relleno a usar para frames de `HEADERS` y `DATA` . **Predeterminado:** `http2.constants.PADDING_STRATEGY_NONE`. El valor puede ser uno de los siguientes: 
    * `http2.constants.PADDING_STRATEGY_NONE` - Especifica que no se deberá aplicar relleno.
    * `http2.constants.PADDING_STRATEGY_MAX` - Especifica que la cantidad máxima de relleno, según lo determinado por la implementación interna, deberá ser aplicada.
    * `http2.constants.PADDING_STRATEGY_CALLBACK` - Specifies that the user provided `options.selectPadding` callback is to be used to determine the amount of padding.
    * `http2.constants.PADDING_STRATEGY_ALIGNED` - *intentará* aplicar suficiente relleno para asegurar que la longitud total del frame, incluyendo el encabezado 9-byte, sea un múltiplo de 8. Sin embargo, para cada frame, hay un número máximo permitido de bytes de relleno que está determinado por el estado actual del control de flujo y las configuraciones. Si este valor máximo es inferior a la cantidad calculada necesaria para asegurar la alineación, el valor máximo será utilizado y la longitud total del frame *no* necesariamente estará alineada en 8 bytes.
  * `peerMaxConcurrentStreams` {number} Sets the maximum number of concurrent streams for the remote peer as if a `SETTINGS` frame had been received. Will be overridden if the remote peer sets its own value for `maxConcurrentStreams`. **Predeterminado:** `100`.
  * `selectPadding` {Function} When `options.paddingStrategy` is equal to `http2.constants.PADDING_STRATEGY_CALLBACK`, provides the callback function used to determine the padding. Vea [Utilización de options.selectPadding](#http2_using_options_selectpadding).
  * `settings` {HTTP/2 Settings Object} The initial settings to send to the remote peer upon connection.
  * ...: Cualquiera de las opciones de [`tls.createServer()`][] pueden ser proporcionadas. Para los servidores, usualmente se requieren las opciones de identidad (`pfx` ó `key`/`cert`).
  * `origins` {string[]} An array of origin strings to send within an `ORIGIN` frame immediately following creation of a new server `Http2Session`.
* `onRequestHandler` {Function} Vea [API de Compatibilidad](#http2_compatibility_api)
* Devuelve: {Http2SecureServer}

Returns a `tls.Server` instance that creates and manages `Http2Session` instances.

```js
const http2 = require('http2');
const fs = require('fs');

const options = {
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
};

// Create a secure HTTP/2 server
const server = http2.createSecureServer(options);

server.on('stream', (stream, headers) => {
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  stream.end('<h1>Hello World</h1>');
});

server.listen(80);
```

### http2.connect(authority\[, options\]\[, listener\])

<!-- YAML
added: v8.4.0
changes:

  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/17105
    description: Added the `maxOutstandingPings` option with a default limit of
                 10.
  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/16676
    description: Added the `maxHeaderListPairs` option with a default limit of
                 128 header pairs.
-->

* `authority` {string|URL}
* `options` {Object} 
  * `maxDeflateDynamicTableSize` {number} Sets the maximum dynamic table size for deflating header fields. **Predeterminado:** `4Kib`.
  * `maxSessionMemory`{number} Sets the maximum memory that the `Http2Session` is permitted to use. The value is expressed in terms of number of megabytes, e.g. `1` equal 1 megabyte. El valor mínimo permitido es `1`. This is a credit based limit, existing `Http2Stream`s may cause this limit to be exceeded, but new `Http2Stream` instances will be rejected while this limit is exceeded. The current number of `Http2Stream` sessions, the current memory use of the header compression tables, current data queued to be sent, and unacknowledged `PING` and `SETTINGS` frames are all counted towards the current limit. **Predeterminado:** `10`.
  * `maxHeaderListPairs` {number} Establece el número máximo de entradas de encabezado. El valor mínimo es `1`. **Predeterminado:** `128`.
  * `maxOutstandingPings` {number} Sets the maximum number of outstanding, unacknowledged pings. **Predeterminado:** `10`.
  * `maxReservedRemoteStreams` {number} Sets the maximum number of reserved push streams the client will accept at any given time. Once the current number of currently reserved push streams exceeds reaches this limit, new push streams sent by the server will be automatically rejected.
  * `maxSendHeaderBlockLength` {number} Sets the maximum allowed size for a serialized, compressed block of headers. Attempts to send headers that exceed this limit will result in a `'frameError'` event being emitted and the stream being closed and destroyed.
  * `paddingStrategy` {number} Identifica la estrategia utilizada para determinar la cantidad de relleno a usar para frames de `HEADERS` y `DATA` . **Predeterminado:** `http2.constants.PADDING_STRATEGY_NONE`. El valor puede ser uno de los siguientes: 
    * `http2.constants.PADDING_STRATEGY_NONE` - Especifica que no se deberá aplicar relleno.
    * `http2.constants.PADDING_STRATEGY_MAX` - Especifica que la cantidad máxima de relleno, según lo determinado por la implementación interna, deberá ser aplicada.
    * `http2.constants.PADDING_STRATEGY_CALLBACK` - Specifies that the user provided `options.selectPadding` callback is to be used to determine the amount of padding.
    * `http2.constants.PADDING_STRATEGY_ALIGNED` - *intentará* aplicar suficiente relleno para asegurar que la longitud total del frame, incluyendo el encabezado 9-byte, sea un múltiplo de 8. Sin embargo, para cada frame, hay un número máximo permitido de bytes de relleno que está determinado por el estado actual del control de flujo y las configuraciones. Si este valor máximo es inferior a la cantidad calculada necesaria para asegurar la alineación, el valor máximo será utilizado y la longitud total del frame *no* necesariamente estará alineada en 8 bytes.
  * `peerMaxConcurrentStreams` {number} Sets the maximum number of concurrent streams for the remote peer as if a `SETTINGS` frame had been received. Will be overridden if the remote peer sets its own value for `maxConcurrentStreams`. **Predeterminado:** `100`.
  * `selectPadding` {Function} When `options.paddingStrategy` is equal to `http2.constants.PADDING_STRATEGY_CALLBACK`, provides the callback function used to determine the padding. Vea [Utilización de options.selectPadding](#http2_using_options_selectpadding).
  * `settings` {HTTP/2 Settings Object} The initial settings to send to the remote peer upon connection.
  * `createConnection` {Function} An optional callback that receives the `URL` instance passed to `connect` and the `options` object, and returns any [`Duplex`][] stream that is to be used as the connection for this session.
  * ...: Cualquiera de las opciones de [`net.connect()`][] o [`tls.connect()`][] pueden ser proporcionadas.
* `listener` {Function}
* Returns {ClientHttp2Session}

Devuelve una instancia `ClientHttp2Session` .

```js
const http2 = require('http2');
const client = http2.connect('https://localhost:1234');

/** use the client **/

client.close();
```

### http2.constants

<!-- YAML
added: v8.4.0
-->

#### Códigos de Error para RST_STREAM y GOAWAY

<a id="error_codes"></a>

| Valor | Nombre                    | Constante                                     |
| ----- | ------------------------- | --------------------------------------------- |
| 0x00  | Sin errores               | `http2.constants.NGHTTP2_NO_ERROR`            |
| 0x01  | Error de Protocolo        | `http2.constants.NGHTTP2_PROTOCOL_ERROR`      |
| 0x02  | Error Interno             | `http2.constants.NGHTTP2_INTERNAL_ERROR`      |
| 0x03  | Error de Control de Flujo | `http2.constants.NGHTTP2_FLOW_CONTROL_ERROR`  |
| 0x04  | Settings Timeout          | `http2.constants.NGHTTP2_SETTINGS_TIMEOUT`    |
| 0x05  | Stream Cerrado            | `http2.constants.NGHTTP2_STREAM_CLOSED`       |
| 0x06  | Error de Tamaño de Frame  | `http2.constants.NGHTTP2_FRAME_SIZE_ERROR`    |
| 0x07  | Stream Negado             | `http2.constants.NGHTTP2_REFUSED_STREAM`      |
| 0x08  | Cancelar                  | `http2.constants.NGHTTP2_CANCEL`              |
| 0x09  | Error de Compresión       | `http2.constants.NGHTTP2_COMPRESSION_ERROR`   |
| 0x0a  | Error de Conexión         | `http2.constants.NGHTTP2_CONNECT_ERROR`       |
| 0x0b  | Enhance Your Calm         | `http2.constants.NGHTTP2_ENHANCE_YOUR_CALM`   |
| 0x0c  | Seguridad Inadecuada      | `http2.constants.NGHTTP2_INADEQUATE_SECURITY` |
| 0x0d  | HTTP/1.1 Requerido        | `http2.constants.NGHTTP2_HTTP_1_1_REQUIRED`   |

The `'timeout'` event is emitted when there is no activity on the Server for a given number of milliseconds set using `http2server.setTimeout()`.

### http2.getDefaultSettings()

<!-- YAML
added: v8.4.0
-->

* Devuelve: {HTTP/2 Settings Object}

Returns an object containing the default settings for an `Http2Session` instance. This method returns a new object instance every time it is called so instances returned may be safely modified for use.

### http2.getPackedSettings(settings)

<!-- YAML
added: v8.4.0
-->

* `settings` {HTTP/2 Settings Object}
* Devuelve: {Buffer}

Returns a `Buffer` instance containing serialized representation of the given HTTP/2 settings as specified in the [HTTP/2](https://tools.ietf.org/html/rfc7540) specification. This is intended for use with the `HTTP2-Settings` header field.

```js
const http2 = require('http2');

const packed = http2.getPackedSettings({ enablePush: false });

console.log(packed.toString('base64'));
// Prints: AAIAAAAA
```

### http2.getUnpackedSettings(buf)

<!-- YAML
added: v8.4.0
-->

* `buf` {Buffer|Uint8Array} Las configuraciones empaquetadas.
* Devuelve: {HTTP/2 Settings Object}

Returns a [HTTP/2 Settings Object](#http2_settings_object) containing the deserialized settings from the given `Buffer` as generated by `http2.getPackedSettings()`.

### Objeto de Encabezados

Los encabezados están representados como propiedades propias sobre los objetos de JavaScript. The property keys will be serialized to lower-case. Property values should be strings (if they are not they will be coerced to strings) or an Array of strings (in order to send more than one value per header field).

Por ejemplo:

```js
const headers = {
  ':status': '200',
  'content-type': 'text-plain',
  'ABC': ['has', 'more', 'than', 'one', 'value']
};

stream.respond(headers);
```

*Note*: Header objects passed to callback functions will have a `null` prototype. This means that normal JavaScript object methods such as `Object.prototype.toString()` and `Object.prototype.hasOwnProperty()` will not work.

Para encabezados entrantes:

* The `:status` header is converted to `number`.
* Duplicates of `:status`, `:method`, `:authority`, `:scheme`, `:path`, `age`, `authorization`, `access-control-allow-credentials`, `access-control-max-age`, `access-control-request-method`, `content-encoding`, `content-language`, `content-length`, `content-location`, `content-md5`, `content-range`, `content-type`, `date`, `dnt`, `etag`, `expires`, `from`, `if-match`, `if-modified-since`, `if-none-match`, `if-range`, `if-unmodified-since`, `last-modified`, `location`, `max-forwards`, `proxy-authorization`, `range`, `referer`,`retry-after`, `tk`, `upgrade-insecure-requests`, `user-agent` or `x-content-type-options` are discarded.
* `set-cookie` siempre es una matriz. Los duplicados se añaden a la matriz.
* `cookie`: the values are joined together with '; '.
* Para todos los otros encabezados, los valores se unen con ', '.

```js
const http2 = require('http2');
const server = http2.createServer();
server.on('stream', (stream, headers) => {
  console.log(headers[':path']);
  console.log(headers.ABC);
});
```

### Objeto de Configuraciones

<!-- YAML
added: v8.4.0
changes:

  - version: v8.9.3
    pr-url: https://github.com/nodejs/node/pull/16676
    description: The `maxHeaderListSize` setting is now strictly enforced.
--> The 

`http2.getDefaultSettings()`, `http2.getPackedSettings()`, `http2.createServer()`, `http2.createSecureServer()`, `http2session.settings()`, `http2session.localSettings`, and `http2session.remoteSettings` APIs either return or receive as input an object that defines configuration settings for an `Http2Session` object. These objects are ordinary JavaScript objects containing the following properties.

* `headerTableSize` {number} Specifies the maximum number of bytes used for header compression. El valor mínimo permitido es 0. The maximum allowed value is 2<sup>32</sup>-1. **Predeterminado:** `4,096 octets`.
* `enablePush` {boolean} Specifies `true` if HTTP/2 Push Streams are to be permitted on the `Http2Session` instances.
* `initialWindowSize` {number} Especifica el tamaño de la ventana inicial de *senders* para el control de flujo a nivel de stream. El valor mínimo permitido es 0. The maximum allowed value is 2<sup>32</sup>-1. **Predeterminado:** `65,535 bytes`.
* `maxFrameSize` {number} Especifica el tamaño de la carga útil del frame más grande. El valor mínimo permitido es 16,384. The maximum allowed value is 2<sup>24</sup>-1. **Predeterminado:** `16,384 bytes`.
* `maxConcurrentStreams` {number} Specifies the maximum number of concurrent streams permitted on an `Http2Session`. No hay valor predeterminado que implique, al menos teóricamente, que los streams de 2<sup>31</sup>-1 pueden abrirse de manera concurrente en cualquier tiempo dado en una `Http2Session`. The minimum value is 0. El valor máximo permitido es 2<sup>31</sup>-1.
* `maxHeaderListSize` {number} Specifies the maximum size (uncompressed octets) of header list that will be accepted. El valor mínimo permitido es 0. The maximum allowed value is 2<sup>32</sup>-1. **Predeterminado:** `65535`.

Se ignoran todas las propiedades adicionales del objeto de las configuraciones.

### Utilizar `options.selectPadding`

When `options.paddingStrategy` is equal to `http2.constants.PADDING_STRATEGY_CALLBACK`, the HTTP/2 implementation will consult the `options.selectPadding` callback function, if provided, to determine the specific amount of padding to use per `HEADERS` and `DATA` frame.

The `options.selectPadding` function receives two numeric arguments, `frameLen` and `maxFrameLen` and must return a number `N` such that `frameLen <= N <= maxFrameLen`.

```js
const http2 = require('http2');
const server = http2.createServer({
  paddingStrategy: http2.constants.PADDING_STRATEGY_CALLBACK,
  selectPadding(frameLen, maxFrameLen) {
    return maxFrameLen;
  }
});
```

*Note*: The `options.selectPadding` function is invoked once for *every* `HEADERS` and `DATA` frame. This has a definite noticeable impact on performance.

### Manejo de Errores

There are several types of error conditions that may arise when using the `http2` module:

Validation Errors occur when an incorrect argument, option, or setting value is passed in. Estos siempre serán reportados por un `throw` sincrónico.

State Errors occur when an action is attempted at an incorrect time (for instance, attempting to send data on a stream after it has closed). These will be reported using either a synchronous `throw` or via an `'error'` event on the `Http2Stream`, `Http2Session` or HTTP/2 Server objects, depending on where and when the error occurs.

Internal Errors occur when an HTTP/2 session fails unexpectedly. These will be reported via an `'error'` event on the `Http2Session` or HTTP/2 Server objects.

Protocol Errors occur when various HTTP/2 protocol constraints are violated. These will be reported using either a synchronous `throw` or via an `'error'` event on the `Http2Stream`, `Http2Session` or HTTP/2 Server objects, depending on where and when the error occurs.

### Manejo inválido de caracteres en nombres de cabecera y valores

The HTTP/2 implementation applies stricter handling of invalid characters in HTTP header names and values than the HTTP/1 implementation.

Los nombres de los campos de cabecera *no distinguen entre mayúsculas y minúsculas*, y se transmiten sobre el cable estrictamente como strings en minúsculas. The API provided by Node.js allows header names to be set as mixed-case strings (e.g. `Content-Type`) but will convert those to lower-case (e.g. `content-type`) upon transmission.

Los nombres de campo del encabezado *sólo deben contener* uno o más de los siguientes caracteres ASCII: `a`-`z`, `A`-`Z`, `0`-`9`, `!`, `#`, `$`, `%`, `&`, `'`, `*`, `+`, `-`, `.`, `^`, `_`, `` ` `` (backtick), `|`, and `~`.

Using invalid characters within an HTTP header field name will cause the stream to be closed with a protocol error being reported.

Los valores de los campos de cabecera se manejan con más indulgencia pero *no deberían* contener caracteres de nueva línea o de retorno y *deberían* estar limitados a caracteres US-ASCII, por los requisitos de la especificación HTTP.

### Push streams en el cliente

To receive pushed streams on the client, set a listener for the `'stream'` event on the `ClientHttp2Session`:

```js
const http2 = require('http2');

const client = http2.connect('http://localhost');

client.on('stream', (pushedStream, requestHeaders) => {
  pushedStream.on('push', (responseHeaders) => {
    // process response headers
  });
  pushedStream.on('data', (chunk) => { /* handle pushed data */ });
});

const req = client.request({ ':path': '/' });
```

### Proporcionar soporte al método CONNECT

The `CONNECT` method is used to allow an HTTP/2 server to be used as a proxy for TCP/IP connections.

Un servidor simple de TCP:

```js
const net = require('net');

const server = net.createServer((socket) => {
  let name = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => name += chunk);
  socket.on('end', () => socket.end(`hello ${name}`));
});

server.listen(8000);
```

Un proxy HTTP/2 CONNECT:

```js
const http2 = require('http2');
const { NGHTTP2_REFUSED_STREAM } = http2.constants;
const net = require('net');
const { URL } = require('url');

const proxy = http2.createServer();
proxy.on('stream', (stream, headers) => {
  if (headers[':method'] !== 'CONNECT') {
    // Only accept CONNECT requests
    stream.close(NGHTTP2_REFUSED_STREAM);
    return;
  }
  const auth = new URL(`tcp://${headers[':authority']}`);
  // It's a very good idea to verify that hostname and port are
  // things this proxy should be connecting to.
  const socket = net.connect(auth.port, auth.hostname, () => {
    stream.respond();
    socket.pipe(stream);
    stream.pipe(socket);
  });
  socket.on('error', (error) => {
    stream.close(http2.constants.NGHTTP2_CONNECT_ERROR);
  });
});

proxy.listen(8001);
```

Un cliente HTTP/2 CONNECT:

```js
const http2 = require('http2');

const client = http2.connect('http://localhost:8001');

// Must not specify the ':path' and ':scheme' headers
// for CONNECT requests or an error will be thrown.
const req = client.request({
  ':method': 'CONNECT',
  ':authority': `localhost:${port}`
});

req.on('response', (headers) => {
  console.log(headers[http2.constants.HTTP2_HEADER_STATUS]);
});
let data = '';
req.setEncoding('utf8');
req.on('data', (chunk) => data += chunk);
req.on('end', () => {
  console.log(`The server says: ${data}`);
  client.close();
});
req.end('Jane');
```

## API de compatibilidad

The Compatibility API has the goal of providing a similar developer experience of HTTP/1 when using HTTP/2, making it possible to develop applications that support both [HTTP/1](http.html) and HTTP/2. Esta API sólo se dirige a la **API pública** del [HTTP/1](http.html). Sin embargo, varios módulos utilizan métodos o estado internos, y esos *no son soportados* ya que consisten en una implementación completamente diferente.

The following example creates an HTTP/2 server using the compatibility API:

```js
const http2 = require('http2');
const server = http2.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});
```

In order to create a mixed [HTTPS](https.html) and HTTP/2 server, refer to the [ALPN negotiation](#http2_alpn_negotiation) section. No se admite la actualización desde servidores que no sean tls HTTP/1.

La API de compatibilidad de HTTP/2 está compuesta por [`Http2ServerRequest`]() y [`Http2ServerResponse`](). They aim at API compatibility with HTTP/1, but they do not hide the differences between the protocols. As an example, the status message for HTTP codes is ignored.

### Negociación ALPN

ALPN negotiation allows supporting both [HTTPS](https.html) and HTTP/2 over the same socket. Los objetos `req` y `res` pueden ser HTTP/1 o HTTP/2, y una aplicación **debe** limitarse a la API pública de [HTTP/1](http.html), y detecta si es posible utilizar las funciones más avanzadas de HTTP/2.

El siguiente ejemplo crea un servidor que soporta a ambos protocolos:

```js
const { createSecureServer } = require('http2');
const { readFileSync } = require('fs');

const cert = readFileSync('./cert.pem');
const key = readFileSync('./key.pem');

const server = createSecureServer(
  { cert, key, allowHTTP1: true },
  onRequest
).listen(4443);

function onRequest(req, res) {
  // detects if it is a HTTPS request or HTTP/2
  const { socket: { alpnProtocol } } = req.httpVersion === '2.0' ?
    req.stream.session : req;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    alpnProtocol,
    httpVersion: req.httpVersion
  }));
}
```

The `'request'` event works identically on both [HTTPS](https.html) and HTTP/2.

### Clase: http2.Http2ServerRequest

<!-- YAML
added: v8.4.0
-->

A `Http2ServerRequest` object is created by [`http2.Server`][] or [`http2.SecureServer`][] and passed as the first argument to the [`'request'`][] event. It may be used to access a request status, headers, and data.

Implementa la interfaz del [Stream Legible](stream.html#stream_class_stream_readable), así como los siguientes eventos adicionales, métodos, y propiedades.

#### Evento: 'aborted'

<!-- YAML
added: v8.4.0
-->

The `'aborted'` event is emitted whenever a `Http2ServerRequest` instance is abnormally aborted in mid-communication.

*Note*: The `'aborted'` event will only be emitted if the `Http2ServerRequest` writable side has not been ended.

#### Evento: 'close'

<!-- YAML
added: v8.4.0
-->

Indica que el [`Http2Stream`][] subyacente fue cerrado. Al igual que `'end'`, este evento ocurre una sola vez por respuesta.

#### request.aborted

<!-- YAML
added: v8.13.0
-->

* {boolean}

The `request.aborted` property will be `true` if the request has been aborted.

#### request.destroy([error])

<!-- YAML
added: v8.4.0
-->

* `error` {Error}

Calls `destroy()` on the [`Http2Stream`][] that received the [`Http2ServerRequest`][]. If `error` is provided, an `'error'` event is emitted and `error` is passed as an argument to any listeners on the event.

No hace nada si el stream ya fue destruido.

#### request.headers

<!-- YAML
added: v8.4.0
-->

* {Object}

El objeto de cabeceras de solicitud/respuesta.

Pares de valores-clave de nombres de encabezado y valores. Los nombres de los encabezados están en minúsculas. Ejemplo:

```js
// Imprime algo similar a:
//
// { 'user-agent': 'curl/7.22.0',
//   host: '127.0.0.1:8000',
//   accept: '*/*' }
console.log(request.headers);
```

Vea [Objeto de Encabezados de HTTP/2](#http2_headers_object).

*Note*: In HTTP/2, the request path, hostname, protocol, and method are represented as special headers prefixed with the `:` character (e.g. `':path'`). These special headers will be included in the `request.headers` object. Care must be taken not to inadvertently modify these special headers or errors may occur. For instance, removing all headers from the request will cause errors to occur:

```js
removeAllHeaders(request.headers);
assert(request.url);   // Fails because the :path header has been removed
```

#### request.httpVersion

<!-- YAML
added: v8.4.0
-->

* {string}

En caso de la solicitud del servidor, la versión HTTP enviada por el cliente. En caso de una respuesta de cliente, la versión HTTP del servidor conectado. Returns `'2.0'`.

Además, `message.httpVersionMajor` es el primer entero y `message.httpVersionMinor` es el segundo.

#### request.method

<!-- YAML
added: v8.4.0
-->

* {string}

El método de solicitud como una string. Sólo lectura. Ejemplo: `'GET'`, `'DELETE'`.

#### request.rawHeaders

<!-- YAML
added: v8.4.0
-->

* {Array}

La lista cruda de solicitudes/cabeceras de respuesta, exactamente como fueron recibidos.

Tenga en cuenta que las claves y los valores están en la misma lista. Esto *not* es una lista de tuplas. Entonces, los elementos pares de la lista serían las valores clave, mientras que los elementos impares serían los valores asociados.

Los nombres de los encabezados no están en minúsculas, y los duplicados no están fusionados.

```js
// Muestro algo similar a:
//
// [ 'user-agent',
// 'esto no es válido porque solo puede haber uno',
// 'User-Agent',
// 'curl/7. 2.0',
// 'Host',
// '127.0.0.1:8000',
// 'ACCEPT',
// '*/*' ]
console.log(request.rawHeaders);
```

#### request.rawTrailers

<!-- YAML
added: v8.4.0
-->

* {Array}

Las claves del trailer y los valores crudos de solicitud/respuesta, exactamente como fueron recibidos. Poblado solamente en el evento `'end'` .

#### request.setTimeout(msecs, callback)

<!-- YAML
added: v8.4.0
-->

* `msecs` {number}
* `callback` {Function}

Establece el valor del tiempo de espera de [`Http2Stream`]() a `msecs`. Si se proporciona un callback, entonces se agregará como un listener en el evento `'timeout'` en el objeto de respuesta.

Si no se añade ningún listener de `'timeout'` a la solicitud, la respuesta, o al servidor, entonces los [`Http2Stream`]()s se destruirán cuando se agote su tiempo de espera. If a handler is assigned to the request, the response, or the server's `'timeout'` events, timed out sockets must be handled explicitly.

Devuelve `request`.

#### request.socket

<!-- YAML
added: v8.4.0
-->

* {net.Socket|tls.TLSSocket}

Returns a Proxy object that acts as a `net.Socket` (or `tls.TLSSocket`) but applies getters, setters, and methods based on HTTP/2 logic.

`destroyed`, `readable`, and `writable` properties will be retrieved from and set on `request.stream`.

`destroy`, `emit`, `end`, `on` and `once` methods will be called on `request.stream`.

El método de `setTimeout` será llamado en `request.stream.session`.

`pause`, `read`, `resume`, and `write` will throw an error with code `ERR_HTTP2_NO_SOCKET_MANIPULATION`. See [Http2Session and Sockets](#http2_http2session_and_sockets) for more information.

Todas las otras interacciones serán enrutadas directamente al socket. With TLS support, use [`request.socket.getPeerCertificate()`][] to obtain the client's authentication details.

#### request.stream

<!-- YAML
added: v8.4.0
-->

* {http2.Http2Stream}

El objeto [`Http2Stream`][] que apoya la solicitud.

#### request.trailers

<!-- YAML
added: v8.4.0
-->

* {Object}

El objeto de trailers de solicitud/respuesta. Poblado solamente en el evento `'end'` .

#### request.url

<!-- YAML
added: v8.4.0
-->

* {string}

String de solicitud de URL. Esto solo contiene la URL que está presente en la solicitud de HTTP actual. Si la solicitud es:

```txt
GET /status?name=ryan HTTP/1.1\r\n
Accept: text/plain\r\n
\r\n
```

Entonces `request.url` será:

<!-- eslint-disable semi -->

```js
'/status?name=ryan'
```

To parse the url into its parts `require('url').parse(request.url)` can be used. Ejemplo:

```txt
$ node
> require('url').parse('/status?name=ryan')
Url {
  protocol: null,
  slashes: null,
  auth: null,
  host: null,
  port: null,
  hostname: null,
  hash: null,
  search: '?name=ryan',
  query: 'name=ryan',
  pathname: '/status',
  path: '/status?name=ryan',
  href: '/status?name=ryan' }
```

To extract the parameters from the query string, the `require('querystring').parse` function can be used, or `true` can be passed as the second argument to `require('url').parse`. Ejemplo:

```txt
$ node
> require('url').parse('/status?name=ryan', true)
Url {
  protocol: null,
  slashes: null,
  auth: null,
  host: null,
  port: null,
  hostname: null,
  hash: null,
  search: '?name=ryan',
  query: { name: 'ryan' },
  pathname: '/status',
  path: '/status?name=ryan',
  href: '/status?name=ryan' }
```

### Clase: http2.Http2ServerResponse

<!-- YAML
added: v8.4.0
-->

Este objeto es creado internamente por un servidor de HTTP — no por el usuario. Es pasado como el segundo parámetro al evento [`'request'`][].

The response implements, but does not inherit from, the [Writable Stream](stream.html#stream_writable_streams) interface. Esto es un [`EventEmitter`][] con los siguientes eventos:

#### Evento: 'close'

<!-- YAML
added: v8.4.0
-->

Indica que el [`Http2Stream`]() subyacente fue eliminado antes de que [`response.end()`][] fuese llamado, o antes de que se hubiera podido vaciar.

#### Evento: 'finish'

<!-- YAML
added: v8.4.0
-->

Se emite cuando la respuesta ha sido enviada. More specifically, this event is emitted when the last segment of the response headers and body have been handed off to the HTTP/2 multiplexing for transmission over the network. Eso no implica que el cliente haya recibido algo aún.

Después de este evento, no se emitirán más eventos en el objeto de respuesta.

#### response.addTrailers(headers)

<!-- YAML
added: v8.4.0
-->

* `headers` {Object}

Este método agrega encabezados finales HTTP (un encabezado pero al final del mensaje) a la respuesta.

Intentar establecer un nombre de campo de cabecera o un valor que contenga caracteres inválidos dará como resultado al lanzamiento de un [`TypeError`][] .

#### response.connection

<!-- YAML
added: v8.4.0
-->

* {net.Socket|tls.TLSSocket}

Vea [`response.socket`][].

#### response.end(\[data\]\[, encoding\][, callback])

<!-- YAML
added: v8.4.0
-->

* `data` {string|Buffer}
* `encoding` {string}
* `callback` {Function}

Este método señala al servidor que todas las cabeceras de respuesta y el cuerpo han sido enviados; y que el servidor debería considerar este mensaje como completo. Este método, `response.end()`, DEBE ser llamado en cada respuesta.

Si se especifica `data`, será equivalente a llamar a [`response.write(data, encoding)`][] seguido por `response.end(callback)`.

Si se especifica el `callback`, será llamado cuando el stream de respuesta haya finalizado.

#### response.finished

<!-- YAML
added: v8.4.0
-->

* {boolean}

Valor booleano que indica si se ha completado la respuesta. Comienza como `false`. Después de que [`response.end()`][] se ejecute, el valor será `true`.

#### response.getHeader(name)

<!-- YAML
added: v8.4.0
-->

* `name` {string}
* Devuelve: {string}

Lee un encabezado que ya ha sido puesto en cola, pero que no ha sido enviado al cliente. Tenga en que el nombre no distingue entre mayúsculas y minúsculas.

Ejemplo:

```js
const contentType = response.getHeader('content-type');
```

#### response.getHeaderNames()

<!-- YAML
added: v8.4.0
-->

* Devuelve: {Array}

Devuelve una matriz que contiene los nombres únicos de los actuales encabezados salientes. Todos los nombres de las cabeceras están en minúsculas.

Ejemplo:

```js
response.setHeader('Foo', 'bar');
response.setHeader('Set-Cookie', ['foo=bar', 'bar=baz']);

const headerNames = response.getHeaderNames();
// headerNames === ['foo', 'set-cookie']
```

#### response.getHeaders()

<!-- YAML
added: v8.4.0
-->

* Devuelve: {Object}

Devuelve una copia superficial de las cabeceras salientes actuales. Since a shallow copy is used, array values may be mutated without additional calls to various header-related http module methods. The keys of the returned object are the header names and the values are the respective header values. All header names are lowercase.

*Note*: The object returned by the `response.getHeaders()` method *does not* prototypically inherit from the JavaScript `Object`. Esto significa que métodos típicos de `Object` tales como `obj.toString()`, `obj.hasOwnProperty()`, entre otros, no están definidos y *no funcionarán*.

Ejemplo:

```js
response.setHeader('Foo', 'bar');
response.setHeader('Set-Cookie', ['foo=bar', 'bar=baz']);

const headers = response.getHeaders();
// headers === { foo: 'bar', 'set-cookie': ['foo=bar', 'bar=baz'] }
```

#### response.hasHeader(name)

<!-- YAML
added: v8.4.0
-->

* `name` {string}
* Devuelve: {boolean}

Returns `true` if the header identified by `name` is currently set in the outgoing headers. Tenga en cuenta que el nombre de cabecera no distingue entre mayúsculas y minúsculas.

Ejemplo:

```js
const hasContentType = response.hasHeader('content-type');
```

#### response.headersSent

<!-- YAML
added: v8.4.0
-->

* {boolean}

Booleano (solo-lectura). Verdadero si las cabeceras fueron enviadas, de lo contrario falso.

#### response.removeHeader(name)

<!-- YAML
added: v8.4.0
-->

* `name` {string}

Elimina un encabezado que ha sido puesto en cola para un envío implícito.

Ejemplo:

```js
response.removeHeader('Content-Encoding');
```

#### response.sendDate

<!-- YAML
added: v8.4.0
-->

* {boolean}

Al ser verdadero, la cabecera de Fecha será generada automáticamente y enviada en la respuesta si no está presente en las cabeceras. Por defecto es verdadero.

Esto solo debería inhabilitarse para las pruebas; HTTP requiere el encabezado de Fecha en las respuestas.

#### response.setHeader(name, value)

<!-- YAML
added: v8.4.0
-->

* `name` {string}
* `value` {string|string[]}

Establece un único valor de cabecera para cabeceras implícitas. Si este encabezado ya existe en los envíos de encabezados pendientes, su valor será reemplazado. Use an array of strings here to send multiple headers with the same name.

Ejemplo:

```js
response.setHeader('Content-Type', 'text/html');
```

o

```js
response.setHeader('Set-Cookie', ['type=ninja', 'language=javascript']);
```

Intentar establecer un nombre de campo de cabecera o un valor que contenga caracteres inválidos dará como resultado al lanzamiento de un [`TypeError`][] .

When headers have been set with [`response.setHeader()`][], they will be merged with any headers passed to [`response.writeHead()`][], with the headers passed to [`response.writeHead()`][] given precedence.

```js
// returns content-type = text/plain
const server = http2.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});
```

#### response.setTimeout(msecs[, callback])

<!-- YAML
added: v8.4.0
-->

* `msecs` {number}
* `callback` {Function}

Establece el valor del tiempo de espera de [`Http2Stream`]() a `msecs`. Si se proporciona un callback, entonces se agregará como un listener en el evento `'timeout'` en el objeto de respuesta.

Si no se añade ningún listener de `'timeout'` a la solicitud, la respuesta, o al servidor, entonces los [`Http2Stream`]()s se destruirán cuando se agote su tiempo de espera. If a handler is assigned to the request, the response, or the server's `'timeout'` events, timed out sockets must be handled explicitly.

Devuelve `response`.

#### response.socket

<!-- YAML
added: v8.4.0
-->

* {net.Socket|tls.TLSSocket}

Returns a Proxy object that acts as a `net.Socket` (or `tls.TLSSocket`) but applies getters, setters, and methods based on HTTP/2 logic.

`destroyed`, `readable`, and `writable` properties will be retrieved from and set on `response.stream`.

`destroy`, `emit`, `end`, `on` and `once` methods will be called on `response.stream`.

El método de `setTimeout` será llamado en `response.stream.session`.

`pause`, `read`, `resume`, and `write` will throw an error with code `ERR_HTTP2_NO_SOCKET_MANIPULATION`. See [Http2Session and Sockets](#http2_http2session_and_sockets) for more information.

Todas las otras interacciones serán enrutadas directamente al socket.

Ejemplo:

```js
const http2 = require('http2');
const server = http2.createServer((req, res) => {
  const ip = req.socket.remoteAddress;
  const port = req.socket.remotePort;
  res.end(`Your IP address is ${ip} and your source port is ${port}.`);
}).listen(3000);
```

#### response.statusCode

<!-- YAML
added: v8.4.0
-->

* {number}

Cuando se utilizan cabeceras implícitas (sin llamar a [`response.writeHead()`][] explícitamente), esta propiedad controla el código de estado que será enviado al cliente cuando las cabeceras sean vaciadas.

Ejemplo:

```js
response.statusCode = 404;
```

Después de que la cabecera de respuesta fue enviada al cliente, esta propiedad indica el código de estado que fue enviado.

#### response.statusMessage

<!-- YAML
added: v8.4.0
-->

* {string}

Mensaje de estado no es soportado por HTTP/2 (RFC7540 8.1.2.4). It returns an empty string.

#### response.stream

<!-- YAML
added: v8.4.0
-->

* {http2.Http2Stream}

El objeto [`Http2Stream`][] que apoya la respuesta.

#### response.write(chunk\[, encoding\]\[, callback\])

<!-- YAML
added: v8.4.0
-->

* `chunk` {string|Buffer}
* `encoding` {string}
* `callback` {Function}
* Devuelve: {boolean}

Si este método es llamado y [`response.writeHead()`][] no se ha llamado, entonces cambiará a modo de cabecera implícita y vaciará las cabeceras implícitas.

Esto envía un fragmento del cuerpo de respuesta. Este método puede ser llamado varias veces para proporcionar partes sucesivas del cuerpo.

Tenga en cuenta que en el módulo `http`, el cuerpo de respuesta se omite cuando la solicitud es una solicitud HEAD. Asimismo, las respuestas `204` y `304` *no deben* incluir un cuerpo de mensaje.

`chunk` puede ser una string o un búfer. Si `chunk` es una string, el segundo parámetro especificará cómo codificarlo dentro de un stream de bytes. Por defecto, el `encoding` es `'utf8'`. `callback` será llamado cuando este fragmento de datos sea vaciado.

*Note*: This is the raw HTTP body and has nothing to do with higher-level multi-part body encodings that may be used.

The first time [`response.write()`][] is called, it will send the buffered header information and the first chunk of the body to the client. The second time [`response.write()`][] is called, Node.js assumes data will be streamed, and sends the new data separately. That is, the response is buffered up to the first chunk of the body.

Devuelve como `true` si todos los datos fueron arrojados con éxito al búfer del núcleo. Devuelve como `false` si todos o parte de los datos fueron puestos en cola en la memoria del usuario. `'drain'` será emitido cuando el búfer esté libre otra vez.

#### response.writeContinue()

<!-- YAML
added: v8.4.0
-->

Sends a status `100 Continue` to the client, indicating that the request body should be sent. See the [`'checkContinue'`][] event on `Http2Server` and `Http2SecureServer`.

#### response.writeHead(statusCode\[, statusMessage\]\[, headers\])

<!-- YAML
added: v8.4.0
-->

* `statusCode` {number}
* `statusMessage` {string}
* `headers` {Object}

Envía una cabecera de respuesta a la solicitud. El código de estado es un código de estado HTTP de 3 dígitos, como `404`. El último argumento, `headers`, son las cabeceras de respuesta.

For compatibility with [HTTP/1](http.html), a human-readable `statusMessage` may be passed as the second argument. However, because the `statusMessage` has no meaning within HTTP/2, the argument will have no effect and a process warning will be emitted.

Ejemplo:

```js
const body = 'hello world';
response.writeHead(200, {
  'Content-Length': Buffer.byteLength(body),
  'Content-Type': 'text/plain' });
```

Tenga en cuenta que la Longitud del Contenido es dada en bytes y no en caracteres. The `Buffer.byteLength()` API may be used to determine the number of bytes in a given encoding. On outbound messages, Node.js does not check if Content-Length and the length of the body being transmitted are equal or not. Sin embargo, cuando reciba mensajes, Node.js rechazará automáticamente los mensajes cuando la longitud del contenido no coincida con el tamaño real del payload.

This method may be called at most one time on a message before [`response.end()`][] is called.

If [`response.write()`][] or [`response.end()`][] are called before calling this, the implicit/mutable headers will be calculated and call this function.

When headers have been set with [`response.setHeader()`][], they will be merged with any headers passed to [`response.writeHead()`][], with the headers passed to [`response.writeHead()`][] given precedence.

```js
// returns content-type = text/plain
const server = http2.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});
```

Intentar establecer un nombre de campo de cabecera o un valor que contenga caracteres inválidos dará como resultado al lanzamiento de un [`TypeError`][] .

#### response.createPushResponse(headers, callback)

<!-- YAML
added: v8.4.0
-->

* `headers` {HTTP/2 Headers Object} Un objeto describiendo los encabezados
* `callback` {Function} Llamada una vez que `http2stream.pushStream()` ha terminado, o bien cuando el intento de crear el pushed `Http2Stream` ha fallado o ha sido rechazado, o el estado de `Http2ServerRequest` está cerrado antes de llamar al `http2stream. método ushStream()` 
  * `err` {Error}
  * `stream` {ServerHttp2Stream} The newly-created `ServerHttp2Stream` object

Llama a [`http2stream.pushStream()`][] con las cabeceras dadas, y envuelve el [`Http2Stream`] dado en una `Http2ServerResponse` recién creado como el parámetro del callback si es exitoso. When `Http2ServerRequest` is closed, the callback is called with an error `ERR_HTTP2_INVALID_STREAM`.

## Recopilar Métricas de Rendimiento de HTTP/2

The [Performance Observer](perf_hooks.html) API can be used to collect basic performance metrics for each `Http2Session` and `Http2Stream` instance.

```js
const { PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  const entry = items.getEntries()[0];
  console.log(entry.entryType);  // prints 'http2'
  if (entry.name === 'Http2Session') {
    // entry contains statistics about the Http2Session
  } else if (entry.name === 'Http2Stream') {
    // entry contains statistics about the Http2Stream
  }
});
obs.observe({ entryTypes: ['http2'] });
```

La propiedad de `entryType` de la `PerformanceEntry` será igual a `'http2'`.

The `name` property of the `PerformanceEntry` will be equal to either `'Http2Stream'` or `'Http2Session'`.

If `name` is equal to `Http2Stream`, the `PerformanceEntry` will contain the following additional properties:

* `bytesRead` {number} The number of `DATA` frame bytes received for this `Http2Stream`.
* `bytesWritten` {number} The number of `DATA` frame bytes sent for this `Http2Stream`.
* `id` {number} El identificador del `Http2Stream` asociado
* `timeToFirstByte` {number} The number of milliseconds elapsed between the `PerformanceEntry` `startTime` and the reception of the first `DATA` frame.
* `timeToFirstByteSent` {number} The number of milliseconds elapsed between the `PerformanceEntry` `startTime` and sending of the first `DATA` frame.
* `timeToFirstHeader` {number} The number of milliseconds elapsed between the `PerformanceEntry` `startTime` and the reception of the first header.

If `name` is equal to `Http2Session`, the `PerformanceEntry` will contain the following additional properties:

* `bytesRead` {number} El número de bytes recibidos para este `Http2Session`.
* `bytesWritten` {number} El número de bytes enviados para este `Http2Session`.
* `framesReceived` {number} The number of HTTP/2 frames received by the `Http2Session`.
* `framesSent` {number} El número de frames HTTP/2 enviados por la `Http2Session`.
* `maxConcurrentStreams` {number} The maximum number of streams concurrently open during the lifetime of the `Http2Session`.
* `pingRTT` {number} The number of milliseconds elapsed since the transmission of a `PING` frame and the reception of its acknowledgment. Only present if a `PING` frame has been sent on the `Http2Session`.
* `streamAverageDuration` {number} The average duration (in milliseconds) for all `Http2Stream` instances.
* `streamCount` {number} The number of `Http2Stream` instances processed by the `Http2Session`.
* `type` {string} Either `'server'` or `'client'` to identify the type of `Http2Session`.