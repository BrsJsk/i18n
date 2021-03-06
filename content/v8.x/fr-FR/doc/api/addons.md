# Extensions C++

<!--introduced_in=v0.10.0-->

Les Extensions C++ sont des objets partagés liés dynamiquement, écrits en C++, qui peuvent être chargés dans Node.js en utilisant la fonction [`require()`](modules.html#modules_require), et utilisés comme s'il s'agissait de modules Node.js ordinaires. Elles sont principalement utilisées pour fournir une interface entre le JavaScript qui s'exécute dans Node.js et des bibliothèques C/C++.

À l'heure actuelle, la façon d'implémenter ces Extensions est plutôt compliquée, et implique la connaissance de plusieurs composants et APIs  :

* V8 : la bibliothèque C++ que Node.js utilise actuellement pour son implémentation de JavaScript. V8 fournit les mécanismes pour créer des objets, appeler des fonctions, etc. L'API de V8 est principalement documentée dans le fichier d'en-tête `v8.h` (`deps/v8/include/v8.h` dans l'arborescence des sources de Node.js), qui est également disponible [en ligne](https://v8docs.nodesource.com/).

* [libuv](https://github.com/libuv/libuv) : la bibliothèque C qui implémente la boucle d'événements de Node.js, ses threads de travail et tous les comportements asynchrones de la plateforme. Elle sert également de bibliothèque d'abstraction inter-plateformes, fournissant sur tous les systèmes d'exploitation majeurs un accès facile, de type POSIX, à de nombreuses tâches systèmes communes, telles que l'interaction avec le système de fichiers, les sockets, les timers et les événements système. libuv fournit aussi une abstraction de threading façon pthreads qui peut être utilisée pour alimenter des extensions asynchrones plus sophistiquées, ayant besoin d'aller au-delà de la boucle événementielle standard. Les auteurs d'Extensions sont encouragés à considérer des manières d'éviter de bloquer la boucle événementielle avec des entrées/sorties (I/O) ou d'autres tâches de longue durée, en déportant le travail via libuv vers des opérations systèmes non-bloquantes, des threads de travail ou une utilisation personnalisée des threads libuv.

* Bibliothèques internes de Node.js. Node.js exporte un certain nombre d'APIs C++ que les Extensions peuvent utiliser — la plus importante de celles-ci étant la classe `node::ObjectWrap`.

* Node.js inclut d'autres bibliothèques liées statiquement, dont OpenSSL. Ces autres bibliothèques se trouvent dans le répertoire `deps/` de l'arborescence des sources de Node.js. Seuls les symboles de libuv, OpenSSL, V8 et zlib sont délibérément ré-exportés par Node.js et peuvent être utilisés à divers degrés par les Extensions. Voir [Liaison vers les dépendances propres de Node.js](#addons_linking_to_node_js_own_dependencies) pour plus d'informations.

Tous les exemples qui suivent sont disponibles en [téléchargement](https://github.com/nodejs/node-addon-examples) et peuvent être utilisés comme point de départ pour une Extension.

## Hello world

Cet exemple « Hello world » est une Extension simple, écrite en C++, qui est l’équivalent du code JavaScript suivant :

```js
module.exports.hello = () => 'world';
```

Tout d’abord, créez le fichier `hello.cc` :

```cpp
// hello.cc
#include <node.h>

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

void Method(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, "world"));
}

void init(Local<Object> exports) {
  NODE_SET_METHOD(exports, "hello", Method);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, init)

}  // namespace demo
```

Notez que toutes les Extensions Node.js doivent exporter une fonction d’initialisation suivant le modèle :

```cpp
void Initialize(Local<Object> exports); NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
```

Il n’y a pas de point-virgule après `NODE_MODULE`, car ce n’est pas une fonction (voir `node.h`).

The `module_name` must match the filename of the final binary (excluding the .node suffix).

Dans l’exemple `hello.cc`, la fonction d’initialisation est `init` et le nom de module de l'Extension est `addon`.

### Compilation

Une fois le code source écrit, il doit être compilé vers le fichier binaire `addon.node`. Pour ce faire, créez un fichier appelé `binding.gyp` au plus haut niveau de l'arborescence du projet décrivant la configuration de génération du module à l’aide d’un format de type JSON. Ce fichier est utilisé par [node-gyp](https://github.com/nodejs/node-gyp) — un outil écrit spécifiquement pour compiler les extensions Node.js.

```json
{
  "targets": [
    {
      "target_name": "addon",
      "sources": [ "hello.cc" ]
    }
  ]
}
```

*Note*: A version of the `node-gyp` utility is bundled and distributed with Node.js as part of `npm`. Cette version n'est pas directement disponible pour les développeurs, et n'est présente que pour permettre d’utiliser la commande `npm install` pour compiler et installer des Extensions. Les développeurs qui souhaitent utiliser `node-gyp` directement peuvent l’installer en utilisant la commande `npm install -g node-gyp`. Voir les [instructions d’installation](https://github.com/nodejs/node-gyp#installation) de `node-gyp` pour plus d’informations, incluant les exigences spécifiques à chaque plateforme.

Une fois que le fichier `binding.gyp` a été créé, utilisez `node-gyp configure` pour générer les fichiers de compilation du projet adaptés à la plateforme sur laquelle vous vous trouvez. Ceci va générer un `Makefile` (sur les platesformes Unix) ou un fichier `vcxproj` (sous Windows) dans le répertoire `build/`.

Ensuite, appelez la commande `node-gyp generate` pour générer le fichier compilé `addon.node`. Celui-ci sera placé dans le répertoire `build/Release/`.

Lorsque vous utilisez `npm install` pour installer une Extension Node.js, npm utilise sa propre version embarquée de `node-gyp` pour effectuer cette même série d’actions, générant à la demande une version compilée de l’Extension pour la plateforme de l’utilisateur.

Une fois générée, l'Extension peut être utilisée au sein de Node.js en pointant [`require()`](modules.html#modules_require) sur le module compilé `addon.node` :

```js
// hello.js
const addon = require('./build/Release/addon');

console.log(addon.hello());
// Prints: 'world'
```

Merci de voir les exemples ci-dessous pour de plus amples informations, ou <https://github.com/arturadib/node-qt> pour un exemple en production.

Comme le chemin exact vers le binaire compilé de l’Extension peut varier en fonction de la façon dont il est compilé (il peut par exemple se trouver dans `./build/Debug/`), les Extensions peuvent utiliser le paquet [bindings](https://github.com/TooTallNate/node-bindings) pour charger le module compilé.

Notez que même si l'implémentation du paquet `bindings` est plus sophistiquée dans sa façon de localiser les modules d'Extension, elle utilise en essence un modèle de try-catch similaire à:

```js
try {
  return require('./build/Release/addon.node');
} catch (err) {
  return require('./build/Debug/addon.node');
}
```

### Liaison vers les dépendances propres de Node.js

Node.js utilise un certain nombre de bibliothèques liées statiquement comme V8, libuv et OpenSSL. Toutes les Extensions sont tenues de lier V8, et peuvent également lier n'importe laquelle des autres dépendances. En général, il suffit d'inclure les déclarations `#include <...>` appropriées (p. ex. `#include <v8.h>`) et `node-gyp` localisera automatiquement les bons en-têtes. Toutefois, il y a quelques points d'attention à connaître:

* Lorsque `node-gyp` est exécuté, la version spécifique de Node.js est détectée, et node-gyp choisira de ne télécharger que les en-têtes, ou bien la source complète. Si la source complète est téléchargée, les Extensions auront un accès complet à l’ensemble des dépendances de Node.js. Mais si seuls les en-têtes de Node.js sont téléchargés, ne seront disponibles que les symboles exportés par Node.js.

* `node-gyp` peut être exécuté avec le flag `--nodedir` pointant vers une image locale des sources de Node.js. Avec cette option, l'Extension aura accès à l'ensemble des dépendances.

### Chargement des Extensions avec require()

L’extension de nom de fichier du binaire de l'Extension compilée est `.node` (plutôt que `.dll` ou `.so`). La fonction [`require()`](modules.html#modules_require) est écrite pour rechercher des fichiers avec l’extension `.node` et les initialiser comme des bibliothèques dynamiquement liées.

Lorsque vous appelez [`require()`](modules.html#modules_require), l’extension de nom de fichier`.node` peut généralement être omise et Node.js saura toujours rechercher et initialiser l’Extension. Un avertissement toutefois: Node.js essaiera en premier lieu de localiser et charger les modules ou fichiers JavaScript qui partageraient le même nom. Par exemple, s’il y a un fichier `addon.js` dans le même répertoire que le binaire `addon.node`, alors [`require('addon')`](modules.html#modules_require) donnera priorité au fichier `addon.js` et le chargera à la place.

## Abstractions Natives pour Node.js

Chacun des exemples illustrés dans le présent document utilise directement les APIs de Node.js et V8 pour implémenter des Extensions. Il est important de comprendre que l’API de V8 peut et a déjà changé de façon importante d’une version de V8 à l’autre (et d'une version majeure de Node.js à l’autre). A chaque changement, les Extensions peuvent nécessiter une mise à jour et une recompilation pour continuer à fonctionner. Le calendrier des parutions de Node.js est conçu pour réduire au minimum la fréquence et l’impact de ces changements, mais Node.js ne peut actuellement pas faire grand chose pour assurer la stabilité des API V8.

Les [Abstractions Natives pour Node.js](https://github.com/nodejs/nan) (Native Abstractions for Node.js ou `nan`) fournissent un ensemble d'outils qu'il est recommandé aux développeurs d'Extensions d'utiliser pour conserver la compatibilité entre les versions passées et futures de V8 et Node.js. Voir les [examples](https://github.com/nodejs/nan/tree/master/examples/) de `nan` pour une illustration de la façon dont ils peuvent être employés.

## N-API

> Stabilité: 1 - Expérimental

N-API est une API pour la création d’Extensions natives. Elle est indépendante de la plateforme d'exécution JavaScript sous-jacente (p. ex. V8) et est maintenue en tant que partie de Node.js. Cette API sera une interface binaire-programme (Application Binary Interface - ABI) stable à travers les différentes versions de Node.js. Son but est d'isoler les Extensions du moteur JavaScript sous-jacent et de permettre aux modules compilés pour une version d'être exécuté sur les versions suivantes de Node.js sans recompilation. Les Extensions sont compilées/empaquetées avec les mêmes approche/outils décrits dans ce document (node-gyp, etc.). La seule différence est l'ensemble d'APIs utilisé par le code natif. Au lieu d'utiliser les APIs V8 ou les [Abstractions Natives pour Node.js](https://github.com/nodejs/nan), les fonctions disponibles dans la N-API sont employées.

Pour utiliser N-API dans l’exemple « Hello world » vu précédemment, remplacez le contenu de `hello.cc` par ce qui suit. Toutes les autres instructions restent les mêmes.

```cpp
// hello.cc using N-API
#include <node_api.h>

namespace demo {

napi_value Method(napi_env env, napi_callback_info args) {
  napi_value greeting;
  napi_status status;

  status = napi_create_string_utf8(env, "hello", NAPI_AUTO_LENGTH, &greeting);
  if (status != napi_ok) return nullptr;
  return greeting;
}

napi_value init(napi_env env, napi_value exports) {
  napi_status status;
  napi_value fn;

  status = napi_create_function(env, nullptr, 0, Method, nullptr, &fn);
  if (status != napi_ok) return nullptr;

  status = napi_set_named_property(env, exports, "hello", fn);
  if (status != napi_ok) return nullptr;
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)

}  // namespace demo
```

Les fonctions disponibles et leur utilisation sont documentées dans la section [Extensions C/C++ - N-API](n-api.html).

## Exemples d'Extensions

Voici quelques exemples d'Extensions destinés à aider les développeurs à démarrer. Ces exemples utilisent les APIs V8. Consultez en ligne la [référence de V8](https://v8docs.nodesource.com/) si vous avez besoin d'aide avec les différents appels spécifiques à V8, et le [Embedder's Guide](https://github.com/v8/v8/wiki/Embedder's%20Guide) de V8 pour une explication de plusieurs concepts utlisés comme les handles, portées, gabarits de fonction, etc.

Chacun de ces exemples utilise le fichier `binding.gyp` suivant:

```json
{
  "targets": [
    {
      "target_name": "addon",
      "sources": [ "addon.cc" ]
    }
  ]
}
```

Dans les cas où il y aurait plus d'un fichier `.cc`, ajoutez simplement les noms de fichiers additionnels au tableau `sources`. For example:

```json
"sources": ["addon.cc", "myexample.cc"]
```

Une fois le fichier `binding.gyp` prêt, l'exemple d'Extension peut être configuré et compilé en utilisant `node-gyp`:

```console
$ node-gyp configure build
```

### Arguments de Fonctions

Les Extensions exposeront généralement des objets et fonctions qui seront accessibles depuis le JavaScript exécuté dans Node.js. Lorsque des fonctions sont appelées à partir de JavaScript, les arguments d’entrée et la valeur de retour doivent être mappés vers et depuis le C/C++.

L’exemple suivant illustre comment lire les arguments d'une fonction passés depuis JavaScript et comment retourner un résultat :

```cpp
// addon.cc
#include <node.h>

namespace demo {

using v8::Exception;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

// Ceci est l'implémentation de la méthode Add
// les arguments d'entréee sont passés en utilisant
// const FunctionCallbackInfo<Value>& args struct
void Add(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  // Vérification du nombre d'arguments envoyés.
  if (args.Length() < 2) {
    // Lance une Erreur qui est renvoyée à JavaScript
    isolate->ThrowException(Exception::TypeError(
        String::NewFromUtf8(isolate, "Mauvais nombre d'arguments")));
    return;
  }

  // Vérifie le type des arguments
  if (!args[0]->IsNumber() || !args[1]->IsNumber()) {
    isolate->ThrowException(Exception::TypeError(
        String::NewFromUtf8(isolate, "Mauvais arguments")));
    return;
  }

  // Exécute l'opération
  double value = args[0]->NumberValue() + args[1]->NumberValue();
  Local<Number> num = Number::New(isolate, value);

  // Assigne la valeur de retour (utilisant le
  // FunctionCallbackInfo<Value>& fourni)
  args.GetReturnValue().Set(num);
}

void Init(Local<Object> exports) {
  NODE_SET_METHOD(exports, "add", Add);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace demo
```

Une fois compilé, l'exemple d'Extension peut être chargé et utilisé depuis Node.js:

```js
// test.js
const addon = require('./build/Release/addon');

console.log('This should be eight:', addon.add(3, 5));
```

### Callbacks

Une pratique commune dans les Extensions consiste à passer une fonction JavaScript à une fonction C++ et à l'exécuter à partir de là. L’exemple suivant illustre comment appeler de tels callbacks:

```cpp
// addon.cc
#include <node.h>

namespace demo {

using v8::Function;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Null;
using v8::Object;
using v8::String;
using v8::Value;

void RunCallback(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Function> cb = Local<Function>::Cast(args[0]);
  const unsigned argc = 1;
  Local<Value> argv[argc] = { String::NewFromUtf8(isolate, "hello world") };
  cb->Call(Null(isolate), argc, argv);
}

void Init(Local<Object> exports, Local<Object> module) {
  NODE_SET_METHOD(module, "exports", RunCallback);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace demo
```

Notez que cet exemple utilise une forme d'`Init()` à deux arguments qui reçoit l’objet `module` complet comme second argument. Cela permet à l'Extension de récrire complètement `exports` avec une seule fonction plutôt que d'ajouter la fonction comme propriété d'`exports`.

Pour tester cette Extension, exécutez le JavaScript suivant:

```js
// test.js
const addon = require('./build/Release/addon');

addon((msg) => {
  console.log(msg);
// Prints: 'hello world'
});
```

Notez que dans cet exemple, la fonction de callback est appelée de façon synchrone.

### Usine à objets

Les Extensions peuvent créer et renvoyer de nouveaux objets depuis une fonction C++ comme illustré par l'exemple suivant. Un objet est créé et renvoyé avec une propriété `msg` qui a pour valeur la chaîne passée à `createObject()`:

```cpp
// addon.cc
#include <node.h>

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

void CreateObject(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  Local<Object> obj = Object::New(isolate);
  obj->Set(String::NewFromUtf8(isolate, "msg"), args[0]->ToString());

  args.GetReturnValue().Set(obj);
}

void Init(Local<Object> exports, Local<Object> module) {
  NODE_SET_METHOD(module, "exports", CreateObject);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace demo
```

Pour tester cette Extension en JavaScript:

```js
// test.js
const addon = require('./build/Release/addon');

const obj1 = addon('hello');
const obj2 = addon('world');
console.log(obj1.msg, obj2.msg);
// Affiche: 'hello world'
```

### Usine à fonctions

Un autre scénario commun est de créer des fonctions JavaScript qui encapsulent des fonctions C++, et de les retourner vers JavaScript:

```cpp
// addon.cc
#include <node.h>

namespace demo {

using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

void MyFunction(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, "hello world"));
}

void CreateFunction(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, MyFunction);
  Local<Function> fn = tpl->GetFunction();

  // omettez cette ligne pour la rendre anonyme
  fn->SetName(String::NewFromUtf8(isolate, "theFunction"));

  args.GetReturnValue().Set(fn);
}

void Init(Local<Object> exports, Local<Object> module) {
  NODE_SET_METHOD(module, "exports", CreateFunction);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace demo
```

Pour tester:

```js
// test.js
const addon = require('./build/Release/addon');

const fn = addon();
console.log(fn());
// Prints: 'hello world'
```

### Encapsuler des objets C++

Il est également possible d'encapsuler des objets/classes C++ d'une façon qui permet de créer de nouvelles instances en utilisant l'opérateur JavaScript `new`:

```cpp
// addon.cc
#include <node.h>
#include "myobject.h"

namespace demo {

using v8::Local;
using v8::Object;

void InitAll(Local<Object> exports) {
  MyObject::Init(exports);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, InitAll)

}  // namespace demo
```

Ensuite, dans `myobject.h`, la classe enveloppe hérite de `node::ObjectWrap`:

```cpp
// myobject.h
#ifndef MYOBJECT_H
#define MYOBJECT_H

#include <node.h>
#include <node_object_wrap.h>

namespace demo {

class MyObject : public node::ObjectWrap {
 public:
  static void Init(v8::Local<v8::Object> exports);

 private:
  explicit MyObject(double value = 0);
  ~MyObject();

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void PlusOne(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  double value_;
};

}  // namespace demo

#endif
```

Dans `myobject.cc`, implémentez les différentes méthodes qui doivent être exposées. Ci-dessous, la méthode `plusOne()` est exposée en l'ajoutant au prototype du constructeur:

```cpp
// myobject.cc
#include "myobject.h"

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

Persistent<Function> MyObject::constructor;

MyObject::MyObject(double value) : value_(value) {
}

MyObject::~MyObject() {
}

void MyObject::Init(Local<Object> exports) {
  Isolate* isolate = exports->GetIsolate();

  // Prepare le gabarit du constructeur
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "MyObject"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "plusOne", PlusOne);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "MyObject"),
               tpl->GetFunction());
}

void MyObject::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // appelé comme constructeur: `new MyObject(...)`
    double value = args[0]->IsUndefined() ? 0 : args[0]->NumberValue();
    MyObject* obj = new MyObject(value);
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // appelée comme fonction brute `MyObject(...)`, devient un appel construct.
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Context> context = isolate->GetCurrentContext();
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> result =
        cons->NewInstance(context, argc, argv).ToLocalChecked();
    args.GetReturnValue().Set(result);
  }
}

void MyObject::PlusOne(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  MyObject* obj = ObjectWrap::Unwrap<MyObject>(args.Holder());
  obj->value_ += 1;

  args.GetReturnValue().Set(Number::New(isolate, obj->value_));
}

}  // namespace demo
```

Pour compiler cet exemple, le fichier `myobject.cc` doit être ajouté à `binding.gyp`:

```json
{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "addon.cc",
        "myobject.cc"
      ]
    }
  ]
}
```

Testez-le avec:

```js
// test.js
const addon = require('./build/Release/addon');

const obj = new addon.MyObject(10);
console.log(obj.plusOne());
// Affiche: 11
console.log(obj.plusOne());
// Affiche: 12
console.log(obj.plusOne());
// Affiche: 13
```

### Usine à objets encapsulés

Comme alternative, il est possible d'utiliser le Design Pattern Factory pour éviter de créer directement des instances d'objets en utilisant l'opérateur JavaScript `new`:

```js
const obj = addon.createObject();
// au lieu de:
// const obj = new addon.Object();
```

D'abord, la méthode `createObject()` est implémentée dans `addon.cc`:

```cpp
// addon.cc
#include <node.h>
#include "myobject.h"

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;

void CreateObject(const FunctionCallbackInfo<Value>& args) {
  MyObject::NewInstance(args);
}

void InitAll(Local<Object> exports, Local<Object> module) {
  MyObject::Init(exports->GetIsolate());

  NODE_SET_METHOD(module, "exports", CreateObject);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, InitAll)

}  // namespace demo
```

Dans `myobject.h`, la méthode statique `NewInstance()` est ajoutée pour gérer l'instanciation de l'objet. Cette méthode prend la place de l'utilisation de `new` en JavaScript:

```cpp
// myobject.h
#ifndef MYOBJECT_H
#define MYOBJECT_H

#include <node.h>
#include <node_object_wrap.h>

namespace demo {

class MyObject : public node::ObjectWrap {
 public:
  static void Init(v8::Isolate* isolate);
  static void NewInstance(const v8::FunctionCallbackInfo<v8::Value>& args);

 private:
  explicit MyObject(double value = 0);
  ~MyObject();

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void PlusOne(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  double value_;
};

}  // namespace demo

#endif
```

L'implémentation dans `myobject.cc` est similaire à celle de l'exemple précédent:

```cpp
// myobject.cc
#include <node.h>
#include "myobject.h"

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

Persistent<Function> MyObject::constructor;

MyObject::MyObject(double value) : value_(value) {
}

MyObject::~MyObject() {
}

void MyObject::Init(Isolate* isolate) {
  // Prépare le gabarit du constructeur
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "MyObject"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  NODE_SET_PROTOTYPE_METHOD(tpl, "plusOne", PlusOne);

  constructor.Reset(isolate, tpl->GetFunction());
}

void MyObject::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // appelé comme constructeur: `new MyObject(...)`
    double value = args[0]->IsUndefined() ? 0 : args[0]->NumberValue();
    MyObject* obj = new MyObject(value);
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // Appelé comme fonction brute `MyObject(...)`,devient un appel construct.
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Context> context = isolate->GetCurrentContext();
    Local<Object> instance =
        cons->NewInstance(context, argc, argv).ToLocalChecked();
    args.GetReturnValue().Set(instance);
  }
}

void MyObject::NewInstance(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  const unsigned argc = 1;
  Local<Value> argv[argc] = { args[0] };
  Local<Function> cons = Local<Function>::New(isolate, constructor);
  Local<Context> context = isolate->GetCurrentContext();
  Local<Object> instance =
      cons->NewInstance(context, argc, argv).ToLocalChecked();

  args.GetReturnValue().Set(instance);
}

void MyObject::PlusOne(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  MyObject* obj = ObjectWrap::Unwrap<MyObject>(args.Holder());
  obj->value_ += 1;

  args.GetReturnValue().Set(Number::New(isolate, obj->value_));
}

}  // namespace demo
```

Une fois encore, pour compiler cet exemple, le fichier `myobject.cc` doit être ajouté à `binding.gyp`:

```json
{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "addon.cc",
        "myobject.cc"
      ]
    }
  ]
}
```

Testez-le avec:

```js
// test.js
const createObject = require('./build/Release/addon');

const obj = createObject(10);
console.log(obj.plusOne());
// Affiche: 11
console.log(obj.plusOne());
// Affiche: 12
console.log(obj.plusOne());
// Affiche: 13

const obj2 = createObject(20);
console.log(obj2.plusOne());
// Affiche: 21
console.log(obj2.plusOne());
// Affiche: 22
console.log(obj2.plusOne());
// Affiche: 23
```

### Transmettre des objets encapsulés

En plus d'encapsuler et de renvoyer des objets C++, il est possible de transmettre ces objets en les désencapsulant avec la fonction outil Node.js `node::ObjectWrap::Unwrap`. Les exemples suivant montrent une fonction `add()` qui peut prendre en entrée deux instances de `MyObject` comme arguments:

```cpp
// addon.cc
#include <node.h>
#include <node_object_wrap.h>
#include "myobject.h"

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

void CreateObject(const FunctionCallbackInfo<Value>& args) {
  MyObject::NewInstance(args);
}

void Add(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  MyObject* obj1 = node::ObjectWrap::Unwrap<MyObject>(
      args[0]->ToObject());
  MyObject* obj2 = node::ObjectWrap::Unwrap<MyObject>(
      args[1]->ToObject());

  double sum = obj1->value() + obj2->value();
  args.GetReturnValue().Set(Number::New(isolate, sum));
}

void InitAll(Local<Object> exports) {
  MyObject::Init(exports->GetIsolate());

  NODE_SET_METHOD(exports, "createObject", CreateObject);
  NODE_SET_METHOD(exports, "add", Add);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, InitAll)

}  // namespace demo
```

Dans `myobject.h`, une nouvelle méthode publique est ajoutée pour permettre l'accès aux valeurs privées après avoir désencapsulé l'objet.

```cpp
// myobject.h
#ifndef MYOBJECT_H
#define MYOBJECT_H

#include <node.h>
#include <node_object_wrap.h>

namespace demo {

class MyObject : public node::ObjectWrap {
 public:
  static void Init(v8::Isolate* isolate);
  static void NewInstance(const v8::FunctionCallbackInfo<v8::Value>& args);
  inline double value() const { return value_; }

 private:
  explicit MyObject(double value = 0);
  ~MyObject();

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  double value_;
};

}  // namespace demo

#endif
```

L'implémentation dans `myobject.cc` est similaire à celle de l'exemple précédent:

```cpp
// myobject.cc
#include <node.h>
#include "myobject.h"

namespace demo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;

Persistent<Function> MyObject::constructor;

MyObject::MyObject(double value) : value_(value) {
}

MyObject::~MyObject() {
}

void MyObject::Init(Isolate* isolate) {
  // Prépare le gabarit du coonstructeur
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "MyObject"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  constructor.Reset(isolate, tpl->GetFunction());
}

void MyObject::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.IsConstructCall()) {
    // appelé comme constructeur: `new MyObject(...)`
    double value = args[0]->IsUndefined() ? 0 : args[0]->NumberValue();
    MyObject* obj = new MyObject(value);
    obj->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    // appelé comme fonction brute `MyObject(...)`, devient un appel construct.
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Context> context = isolate->GetCurrentContext();
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    Local<Object> instance =
        cons->NewInstance(context, argc, argv).ToLocalChecked();
    args.GetReturnValue().Set(instance);
  }
}

void MyObject::NewInstance(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  const unsigned argc = 1;
  Local<Value> argv[argc] = { args[0] };
  Local<Function> cons = Local<Function>::New(isolate, constructor);
  Local<Context> context = isolate->GetCurrentContext();
  Local<Object> instance =
      cons->NewInstance(context, argc, argv).ToLocalChecked();

  args.GetReturnValue().Set(instance);
}

}  // namespace demo
```

Testez-le avec:

```js
// test.js
const addon = require('./build/Release/addon');

const obj1 = addon.createObject(10);
const obj2 = addon.createObject(20);
const result = addon.add(obj1, obj2);

console.log(result);
// Affiche: 30
```

### AtExit hooks

An "AtExit" hook is a function that is invoked after the Node.js event loop has ended but before the JavaScript VM is terminated and Node.js shuts down. "AtExit" hooks are registered using the `node::AtExit` API.

#### void AtExit(callback, args)

* `callback` {void (*)(void*)} A pointer to the function to call at exit.
* `args` {void\*} A pointer to pass to the callback at exit.

Enregistre un hook de sortie qui est exécuté après que la boucle évènementielle de Node. js se soit arrêtée mais avant que la machine virtuelle JavaScript soit détruite.

AtExit prend deux paramètres: un pointeur vers un callback à appeler à la sortie, et un pointeur vers des données de contexte non-typées à passer à ce callback.

Les callbacks sont exécutés dans l'ordre dernier entré, premier sorti.

The following `addon.cc` implements AtExit:

```cpp
// addon.cc
#include <assert.h>
#include <stdlib.h>
#include <node.h>

namespace demo {

using node::AtExit;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;

static char cookie[] = "yum yum";
static int at_exit_cb1_called = 0;
static int at_exit_cb2_called = 0;

static void at_exit_cb1(void* arg) {
  Isolate* isolate = static_cast<Isolate*>(arg);
  HandleScope scope(isolate);
  Local<Object> obj = Object::New(isolate);
  assert(!obj.IsEmpty());  // assert VM is still alive
  assert(obj->IsObject());
  at_exit_cb1_called++;
}

static void at_exit_cb2(void* arg) {
  assert(arg == static_cast<void*>(cookie));
  at_exit_cb2_called++;
}

static void sanity_check(void*) {
  assert(at_exit_cb1_called == 1);
  assert(at_exit_cb2_called == 2);
}

void init(Local<Object> exports) {
  AtExit(at_exit_cb2, cookie);
  AtExit(at_exit_cb2, cookie);
  AtExit(at_exit_cb1, exports->GetIsolate());
  AtExit(sanity_check);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, init)

}  // namespace demo
```

Testez en JavaScript en exécutant:

```js
// test.js
require('./build/Release/addon');
```