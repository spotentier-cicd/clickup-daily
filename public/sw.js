/*
| LE TRAVAILLEUR DE SERVICE.
|
| Il est là pour que l'application s'INSTALLE — une fenêtre à elle, une icône
| dans le dock — pas pour la faire marcher hors ligne : tout ce qu'elle montre
| vient du serveur, et un tableau de bord sans serveur n'a rien à dire.
|
| C'est la règle qui tient tout le fichier, et c'est la même que celle du
| bandeau « ce rapport date du… » : des données périmées ne doivent JAMAIS
| avoir l'allure de données fraîches. On ne met donc en cache que ce dont le
| contenu ne peut pas mentir —
|
|   — /assets/*  : les fichiers de build. Leur nom porte l'empreinte de leur
|                  contenu, donc une version en cache est forcément la bonne ;
|   — /offline.html : la page qui dit qu'il n'y a plus personne au bout.
|
| Tout le reste — les navigations, les requêtes Inertia, /refresh, les
| préférences — part au réseau. Une réponse Inertia mise en cache rouvrirait
| le tableau sur les tickets d'avant-hier, sans rien pour le signaler.
|
| Le fichier est servi tel quel depuis public/ : il n'est ni compilé ni
| empreint, et sa portée est donc la racine du site.
*/

/*
| À INCRÉMENTER quand offline.html change : la page est mise en cache à
| l'installation du travailleur, et le navigateur ne réinstalle celui-ci que
| si SES octets à lui ont bougé. Sans ça, l'ancienne page resterait servie.
*/
const VERSION = 'v2'
const SHELL = `point-clickup-shell-${VERSION}`
const ASSETS = `point-clickup-assets-${VERSION}`
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new Request(OFFLINE, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  /*
   * Les fichiers de build. Leur nom change à chaque contenu : une entrée en
   * cache ne peut pas être périmée, et il est donc inutile de revalider.
   *
   * Les entrées des builds précédents restent, inertes — le navigateur les
   * évince sous pression de stockage. Les purger demanderait de connaître ici
   * la liste des fichiers du build courant, ce qui coûterait plus cher que
   * les quelques centaines de kilo-octets qu'elles pèsent.
   */
  if (new URL(request.url).pathname.startsWith('/assets/')) {
    event.respondWith(fromCache(request))
    return
  }

  /* Une navigation : le réseau, et la page « hors ligne » s'il ne répond pas. */
  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request))
  }
})

async function fromCache(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function fromNetwork(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(SHELL)
    return (await cache.match(OFFLINE)) ?? Response.error()
  }
}
