/* Servicio para cargar el manifiesto de imágenes desde /assets
   - Comentarios en español
   - Usa baseURI para que funcione en subcarpetas
   - Logs "PruebaPte" para depurar rápido */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { map, catchError, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private http = inject(HttpClient);
  private doc = inject(DOCUMENT);

  /** Construye la URL final respetando <base href> */
  private url(path: string): string {
    const finalUrl = new URL(path, this.doc.baseURI).toString();
    return finalUrl;
  }

  /** Carga el manifiesto y devuelve rutas absolutas de imágenes */
  loadImages() {
    const manifestPath = 'assets/pics/manifest.json'; // ¡sin slash inicial!
    const manifestUrl = this.url(manifestPath);
    console.log('PruebaPte[GalleryService] manifestUrl:', manifestUrl);

    return this.http.get<string[]>(manifestUrl).pipe(
      tap({
        next: (files) => console.log('PruebaPte[GalleryService] manifest OK:', files),
        error: (err) => console.error('PruebaPte[GalleryService] manifest ERROR:', err)
      }),
      map(files => (files ?? []).map(f => this.url(`assets/pics/${f}`))),
      catchError((err) => {
        console.error('PruebaPte[GalleryService] catchError → devolver []', err);
        return of<string[]>([]);
      })
    );
  }
}
