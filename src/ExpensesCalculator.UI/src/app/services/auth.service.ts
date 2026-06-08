import { HttpClient, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthResponse, TokenService } from './token.service';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { CanActivate, Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  public userName = '';

  constructor(
    private http: HttpClient,
    private tokens: TokenService
  ) {
    const token = this.tokens.getAccessToken();
    if (token){
      const decoded = this.decodeToken(token);
      this.userName = decoded?.unique_name || '';
    }
  }

  login(userName: string, password: string) {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { userName, password })
      .pipe(
        tap(response => {
          this.tokens.setTokens(response.accessToken, response.refreshToken)
          const decoded = this.decodeToken(response.accessToken);
          this.userName = decoded?.unique_name || '';
        })
      );
  }

  register(userName: string, password: string) {
    return this.http.post(`${this.apiUrl}/register`, { userName, password });
  }

  refreshToken() {
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {
      refreshToken: this.tokens.getRefreshToken() 
    }).pipe(
      tap(response => this.tokens.setTokens(response.accessToken, response.refreshToken))
    );
  }

  logout() {
    return this.http.post<AuthResponse>(`${this.apiUrl}/logout`, {
      refreshToken: this.tokens.getRefreshToken()
    }).pipe(
      tap(() => {
        this.tokens.clear()
        this.userName = '';
      })
    );
  }

  isAuthenticated(): boolean {
    return !!this.tokens.getAccessToken();
  }

  private decodeToken(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private tokens: TokenService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.tokens.getAccessToken();

    if (!token) return next.handle(req);

    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(authReq);
  }
}

@Injectable()
export class RefreshInterceptor implements HttpInterceptor {
  private isRefreshing = false;

  constructor(
    private auth: AuthService,
    private tokens: TokenService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      catchError(err => {
        // Only handle 401 errors, skip if already refreshing or if this is the refresh endpoint
        if (err.status === 401 && !this.isRefreshing && !req.url.includes('/auth/refresh')) {
          this.isRefreshing = true;

          return this.auth.refreshToken().pipe(
            switchMap(() => {
              this.isRefreshing = false;

              // Retry the original request with the new token
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${this.tokens.getAccessToken()}`
                }
              });

              return next.handle(retryReq);
            }),
            catchError(() => {
              this.isRefreshing = false;
              this.tokens.clear();
              this.router.navigate(['/login']);
              return throwError(() => err);
            })
          );
        }

        return throwError(() => err);
      })
    );
  }
}

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.auth.isAuthenticated()) return true;

    this.router.navigate(['/login']);
    return false;
  }
}

