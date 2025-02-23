import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <main class="container mx-auto px-4 py-8">
        <div class="flex flex-col items-center gap-6">
          <!-- Fetch Prices Button -->
          <form class="w-full max-w-md" (submit)="checkItem($event)">
            <button 
              type="submit"
              class="w-full px-6 py-3 bg-purple-500 text-gray-100 hover:bg-purple-600 
                     text-gray-200 font-medium rounded-lg shadow-lg 
                     transition-all duration-200 transform hover:scale-[1.02]
                     active:scale-[0.98]">
              Fetch GE Prices
            </button>
          </form>

          <!-- Status Message -->
          <p *ngIf="itemData" class="text-gray-300">
            {{ itemData }}
          </p>

          <!-- Router Outlet -->
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class AppComponent {
  itemData = '';

  constructor(private router: Router) {}

  checkItem(event: SubmitEvent): void {
    event.preventDefault();
    console.log('Button clicked, invoking fetch_latest');

    invoke<string>('fetch_latest')
      .then((response: string) => {
        console.log('Response received:', response);
        this.itemData = response;
        this.router.navigate(['/items'])
          .then(success => console.log('Navigation success:', success))
          .catch(err => console.error('Navigation error:', err));
      })
      .catch((error: string) => {
        console.error('Error invoking Tauri command:', error);
      });
  }
}