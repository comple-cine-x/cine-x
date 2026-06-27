import random
import pickle
from itertools import combinations

import grafo as modulo_grafo

MINIMO_PELICULAS_EN_COMUN = 3
TOP_K_SIMILARES = 5
PORCENTAJE_PELICULAS_EXCLUIDAS = 0.05
MAXIMO_USUARIOS_POR_PELICULA_PARA_COMPARAR = 200
ARCHIVO_COMUNIDADES = "comunidades.pkl"


class UnionFind:
    def __init__(self, elementos):
        self.padre = {e: e for e in elementos}

    def find(self, x):
        if self.padre[x] != x:
            self.padre[x] = self.find(self.padre[x])
        return self.padre[x]

    def union(self, x, y):
        raiz_x = self.find(x)
        raiz_y = self.find(y)
        if raiz_x != raiz_y:
            self.padre[raiz_y] = raiz_x


def identificar_peliculas_excluidas(peliculas_por_usuario, porcentaje_excluido=PORCENTAJE_PELICULAS_EXCLUIDAS):
    conteo_espectadores = {}
    for peliculas in peliculas_por_usuario.values():
        for pelicula in peliculas:
            conteo_espectadores[pelicula] = conteo_espectadores.get(pelicula, 0) + 1

    peliculas_ordenadas = sorted(conteo_espectadores.items(), key=lambda x: x[1], reverse=True)
    cantidad_excluida = int(len(peliculas_ordenadas) * porcentaje_excluido)
    return {p for p, _ in peliculas_ordenadas[:cantidad_excluida]}


def calcular_similitudes(grafo, maximo_usuarios=MAXIMO_USUARIOS_POR_PELICULA_PARA_COMPARAR):
    usuarios = [n for n, d in grafo.nodes(data=True) if d.get("tipo") == "usuario"]

    peliculas_por_usuario_completo = {
        usuario: set(grafo.neighbors(usuario)) for usuario in usuarios
    }

    peliculas_excluidas = identificar_peliculas_excluidas(peliculas_por_usuario_completo)

    peliculas_por_usuario = {
        usuario: peliculas - peliculas_excluidas
        for usuario, peliculas in peliculas_por_usuario_completo.items()
    }

    peliculas_a_usuarios = {}
    for usuario, peliculas in peliculas_por_usuario.items():
        for pelicula in peliculas:
            peliculas_a_usuarios.setdefault(pelicula, []).append(usuario)

    similitudes = {usuario: [] for usuario in usuarios}
    pares_revisados = set()
    random.seed(7)

    for pelicula, lista_usuarios in peliculas_a_usuarios.items():
        if len(lista_usuarios) > maximo_usuarios:
            lista_usuarios = random.sample(lista_usuarios, maximo_usuarios)

        for u1, u2 in combinations(lista_usuarios, 2):
            par = (u1, u2) if u1 < u2 else (u2, u1)
            if par in pares_revisados:
                continue
            pares_revisados.add(par)

            comunes = peliculas_por_usuario[u1] & peliculas_por_usuario[u2]
            if len(comunes) >= MINIMO_PELICULAS_EN_COMUN:
                similitudes[u1].append((u2, len(comunes)))
                similitudes[u2].append((u1, len(comunes)))

    return usuarios, similitudes


def construir_comunidades(usuarios, similitudes, top_k=TOP_K_SIMILARES):
    uf = UnionFind(usuarios)
    top_similares = {}

    for usuario, lista in similitudes.items():
        lista_ordenada = sorted(lista, key=lambda x: x[1], reverse=True)
        top_similares[usuario] = set(u for u, _ in lista_ordenada[:top_k])

    for usuario, top in top_similares.items():
        for otro in top:
            if usuario in top_similares.get(otro, set()):
                uf.union(usuario, otro)

    grupos = {}
    for usuario in usuarios:
        raiz = uf.find(usuario)
        grupos.setdefault(raiz, []).append(usuario)

    return grupos


def guardar_comunidades(grupos, ruta=ARCHIVO_COMUNIDADES):
    with open(ruta, "wb") as archivo:
        pickle.dump(grupos, archivo)


def cargar_comunidades(ruta=ARCHIVO_COMUNIDADES):
    with open(ruta, "rb") as archivo:
        return pickle.load(archivo)


def obtener_grupo_de_usuario(grupos, usuario_id):
    for miembros in grupos.values():
        if usuario_id in miembros:
            return miembros
    return []


def main():
    grafo = modulo_grafo.cargar_grafo("grafo.pkl")

    print("Calculando similitudes entre usuarios...")
    usuarios, similitudes = calcular_similitudes(grafo)

    print(f"Agrupando usuarios (top {TOP_K_SIMILARES} mutuo, minimo {MINIMO_PELICULAS_EN_COMUN} peliculas en comun)...")
    grupos = construir_comunidades(usuarios, similitudes)

    guardar_comunidades(grupos)
    print(f"Comunidades guardadas en {ARCHIVO_COMUNIDADES}")

    grupos_con_mas_de_uno = {r: miembros for r, miembros in grupos.items() if len(miembros) > 1}

    print(f"Total de comunidades con 2+ usuarios: {len(grupos_con_mas_de_uno)}")
    tamanos_ordenados = sorted(grupos_con_mas_de_uno.items(), key=lambda x: len(x[1]), reverse=True)
    for raiz, miembros in tamanos_ordenados[:10]:
        print(f"  Comunidad de {raiz}: {len(miembros)} usuarios -> {miembros[:10]}")


if __name__ == "__main__":
    main()
