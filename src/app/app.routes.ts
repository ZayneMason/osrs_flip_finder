import { Routes } from '@angular/router';
import { ItemsComponent } from './items/items.component';
import { ItemDetailComponent } from './items/item-detail.component';

export const routes: Routes = [
  { path: 'items', component: ItemsComponent },
  { path: '', redirectTo: '/items', pathMatch: 'full' },
  { path: 'items/:id', component: ItemDetailComponent, pathMatch: 'full'}
];