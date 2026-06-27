from flask import Flask, jsonify, render_template, request
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
import grafo as modulo_grafo
import bfs_recomendaciones as bfs_mod
import union_find_comunidades as uf_mod
import programacion_dinamica as pd_mod

app = Flask(__name__)
grafo = modulo_grafo.cargar_grafo("grafo.pkl")
comunidades = uf_mod.cargar_comunidades("comunidades.pkl")


@app.route("/")
def index():
    return render_template("index.html", tmdb_key=os.getenv("TMDB_KEY", ""))


@app.route("/api/bfs/<usuario_id>")
def api_bfs(usuario_id):
    if usuario_id not in grafo.nodes:
        return jsonify({"error": "Usuario no encontrado"}), 404
    resultados = bfs_mod.bfs_recomendaciones(grafo, usuario_id)
    return jsonify(resultados[:50])


@app.route("/api/pd/<usuario_id>")
def api_pd(usuario_id):
    if usuario_id not in grafo.nodes:
        return jsonify({"error": "Usuario no encontrado"}), 404
    resultados = pd_mod.recomendar_con_pd(grafo, comunidades, usuario_id)
    return jsonify(resultados)


@app.route("/api/comunidad/<usuario_id>")
def api_comunidad(usuario_id):
    if usuario_id not in grafo.nodes:
        return jsonify({"error": "Usuario no encontrado"}), 404
    grupo = uf_mod.obtener_grupo_de_usuario(comunidades, usuario_id)
    if len(grupo) <= 1:
        return jsonify({"comunidad": [], "mensaje": "Este usuario no pertenece a ninguna comunidad"})
    return jsonify({"comunidad": grupo})


@app.route("/api/grafo/<usuario_id>")
def api_grafo(usuario_id):
    if usuario_id not in grafo.nodes:
        return jsonify({"error": "Usuario no encontrado"}), 404

    # Limites para mantener la visualizacion legible y rapida
    MAX_VECINOS = int(request.args.get("max_vecinos", 12))
    MAX_PELIS_VECINO = 8

    # Peliculas que ha visto el usuario central (sus "vistas")
    pelis_usuario = [
        n for n in grafo.neighbors(usuario_id)
        if grafo.nodes[n].get("tipo") == "pelicula"
    ]
    set_pelis_usuario = set(pelis_usuario)

    nodos = {}
    aristas = []

    def agregar_nodo(node_id, tipo, **extra):
        if node_id not in nodos:
            datos = {"id": node_id, "tipo": tipo}
            datos.update(extra)
            nodos[node_id] = datos
        return nodos[node_id]

    # Nodo central
    agregar_nodo(usuario_id, "usuario", label=usuario_id, central=True)

    # Peliculas del usuario central + aristas (con su rating)
    for m in pelis_usuario:
        agregar_nodo(
            m, "pelicula",
            label=grafo.nodes[m].get("titulo", "Desconocida"),
            titulo=grafo.nodes[m].get("titulo", "Desconocida"),
        )
        aristas.append({
            "source": usuario_id,
            "target": m,
            "weight": grafo[usuario_id][m]["weight"],
            "tipo": "propia",
        })

    # Vecinos de la comunidad conectados a traves de peliculas en comun
    grupo = uf_mod.obtener_grupo_de_usuario(comunidades, usuario_id)
    vecinos = [u for u in grupo if u != usuario_id]

    # Ordenar vecinos por cantidad de peliculas compartidas (mas relevante primero)
    vecinos_con_comunes = []
    for v in vecinos:
        comunes = set(grafo.neighbors(v)) & set_pelis_usuario
        if comunes:
            vecinos_con_comunes.append((v, comunes))
    vecinos_con_comunes.sort(key=lambda x: len(x[1]), reverse=True)

    for v, comunes in vecinos_con_comunes[:MAX_VECINOS]:
        agregar_nodo(v, "usuario", label=v, central=False)
        for m in list(comunes)[:MAX_PELIS_VECINO]:
            aristas.append({
                "source": v,
                "target": m,
                "weight": grafo[v][m]["weight"],
                "tipo": "compartida",
            })

    resumen = {
        "usuarios": sum(1 for n in nodos.values() if n["tipo"] == "usuario"),
        "peliculas": sum(1 for n in nodos.values() if n["tipo"] == "pelicula"),
        "aristas": len(aristas),
    }

    return jsonify({
        "central": usuario_id,
        "nodes": list(nodos.values()),
        "edges": aristas,
        "resumen": resumen,
    })


@app.route("/api/usuario/<usuario_id>/peliculas")
def api_peliculas_vistas(usuario_id):
    if usuario_id not in grafo.nodes:
        return jsonify({"error": "Usuario no encontrado"}), 404
    peliculas = [
        {"id": n, "titulo": grafo.nodes[n].get("titulo", "Desconocida"), "rating": grafo[usuario_id][n]["weight"]}
        for n in grafo.neighbors(usuario_id)
        if grafo.nodes[n].get("tipo") == "pelicula"
    ]
    peliculas.sort(key=lambda x: x["rating"], reverse=True)
    return jsonify(peliculas)


@app.route("/api/tmdb/search")
def tmdb_search():
    import requests
    query = request.args.get("query", "")
    year = request.args.get("year", "")
    key = os.getenv("TMDB_KEY", "")
    url = f"https://api.themoviedb.org/3/search/movie?api_key={key}&query={query}&language=es-ES" + (f"&year={year}" if year else "")
    r = requests.get(url, timeout=5)
    return jsonify(r.json())

@app.route("/api/tmdb/detail/<int:movie_id>")
def tmdb_detail(movie_id):
    import requests
    key = os.getenv("TMDB_KEY", "")
    url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={key}&language=es-ES&append_to_response=credits,videos,similar"
    r = requests.get(url, timeout=5)
    return jsonify(r.json())

if __name__ == "__main__":
    app.run(debug=True)






