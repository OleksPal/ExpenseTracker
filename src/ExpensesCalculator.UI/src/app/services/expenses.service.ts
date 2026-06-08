import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Check } from './checks.service';
import { environment } from '../../environments/environment';

export interface DayExpenses {
  id: string;
  date: Date;
  location: string;
  participants: string[];
  peopleWithAccess: string[];
  totalSum: number;
}

export interface DayExpensesDetails extends DayExpenses {
  checks: Check[];
}
export interface PagedDayExpensesResult {
  items: DayExpenses[];
  totalPages: number;
  fromDate: string;
  toDate: string;
}

export interface ShareDayExpensesResponse {
  isSuccess: boolean;
  error: string;
}

// Calculation interfaces
export interface SenderRecipient {
  sender: string;
  recipient: string;
}

export interface Transaction {
  checkName: string;
  subjects: SenderRecipient;
  transferAmount: number;
}

export interface ItemCalculation {
  item: {
    id: string;
    name: string;
    description: string;
    price: number;
    amount: number;
    rating: number;
    tags: string[];
    users: string[];
    checkId: string;
  };
  pricePerUser: number;
}

export interface CheckCalculation {
  check: {
    id: string;
    location: string;
    payer: string;
    totalSum: number;
    dayExpensesId: string;
  };
  items: ItemCalculation[];
  sumPerParticipant: number;
}

export interface DayExpensesCalculation {
  userName: string;
  checkCalculations: CheckCalculation[];
}

export interface DayExpensesCalculationsDto {
  dayExpensesId: string;
  participants: string[];
  totalSum: number;
  checks: { id: string; location: string; payer: string; dayExpensesId: string; }[];
  dayExpensesCalculations: DayExpensesCalculation[];
  allUsersTransactions: Transaction[];
  optimizedUserTransactions: Transaction[];
}

@Injectable({
  providedIn: 'root'
})
export class ExpensesService {
  private apiUrl = `${environment.apiUrl}/`;

  constructor(private http: HttpClient) { }

  getAllDayExpenses(sortColumn: string = 'Date', sortOrder: string = 'desc', 
    filterText: string = '', filterCriteria: string = 'all',
    fromDate: string = '', toDate: string = '',
    pageNumber: number = 1, pageSize: number = 10): Observable<PagedDayExpensesResult> {
    const params = new HttpParams()
      .set('sortColumn', sortColumn)
      .set('sortOrder', sortOrder)
      .set('filterText', filterText)
      .set('filterCriteria', filterCriteria)
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PagedDayExpensesResult>(`${this.apiUrl}DayExpenses`, { params })
  }

  getDayExpensesDetails(id: string): Observable<DayExpensesDetails> {
    return this.http.get<DayExpensesDetails>(`${this.apiUrl}DayExpenses/${id}/details`)
  }

  createDayExpenses(date: string, location: string, participants: string[]) {
    const body = {
      date: date,
      location: location,
      participants: participants
    }

    return this.http.post<DayExpenses>(`${this.apiUrl}DayExpenses`, body);
  }

  editDayExpenses(id: string, date: string, location: string, participants: string[]) {
    const body = {
      id: id,
      date: date,
      location: location,
      participants: participants
    }

    return this.http.put<DayExpenses>(`${this.apiUrl}DayExpenses`, body);
  }

  deleteDayExpenses(id: string) {   
    return this.http.delete<void>(`${this.apiUrl}DayExpenses/${id}`);
  }

  shareDayExpenses(id: string, newUserWithAccess: string) {
    return this.http.post<ShareDayExpensesResponse>(`${this.apiUrl}DayExpenses/${id}/share`, { newUserWithAccess });
  }

  getCalculations(id: string): Observable<DayExpensesCalculationsDto> {
    return this.http.get<DayExpensesCalculationsDto>(`${this.apiUrl}DayExpenses/${id}/calculate`);
  }
}
