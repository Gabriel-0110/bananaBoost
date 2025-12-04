
import { Component, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewChecked {
  private geminiService = inject(GeminiService);

  // State Signals
  currentImage = signal<string | null>(null);
  originalImage = signal<string | null>(null);
  chatMessages = signal<ChatMessage[]>([
    { role: 'model', text: "👋 I'm Nano Banana. Upload a photo and I'll help you look your best. Try prompts like 'Fix the lighting' or 'Make me look fit'." }
  ]);
  isProcessing = signal<boolean>(false);
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  // Lifecycle to auto-scroll chat
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  // --- Image Handling ---

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  processFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.currentImage.set(result);
      this.originalImage.set(result);
      // Add system note
      this.chatMessages.update(msgs => [...msgs, { role: 'model', text: "Photo received! What would you like to change?" }]);
    };
    reader.readAsDataURL(file);
  }

  // --- Core Interaction Logic ---

  async sendMessage(text: string) {
    if (!text.trim() || this.isProcessing()) return;

    const userText = text.trim();
    
    // Add user message to UI
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: userText }]);
    this.isProcessing.set(true);

    try {
      // 1. Determine if this request requires image generation
      // Simple heuristic: Does it contain "add", "remove", "change", "make", "style", "filter"?
      const generationKeywords = ['add', 'remove', 'change', 'make', 'style', 'filter', 'background', 'suit', 'muscle', 'fit', 'hair', 'beard', 'light'];
      const isGenerationRequest = generationKeywords.some(k => userText.toLowerCase().includes(k)) && this.currentImage();

      if (isGenerationRequest) {
        // --- Generation Flow ---
        
        // A. Analyze image + user text to get a prompt
        const prompt = await this.geminiService.analyzeAndRefinePrompt(
          // For analysis, we send the *original* (or currently visible) image to base the edit on
          this.currentImage(), 
          userText,
          this.chatMessages() // Pass history for context
        );

        // B. Generate Image
        const newImageBase64 = await this.geminiService.generateImage(prompt);
        
        // C. Update State
        this.currentImage.set(newImageBase64);
        this.chatMessages.update(msgs => [...msgs, { role: 'model', text: "Here is the result. How does it look? You can refine it further." }]);

      } else {
        // --- Chat Only Flow ---
        const response = await this.geminiService.chatWithAssistant(this.chatMessages(), userText);
        this.chatMessages.update(msgs => [...msgs, { role: 'model', text: response }]);
      }

    } catch (error) {
      console.error(error);
      this.chatMessages.update(msgs => [...msgs, { role: 'model', text: "⚠️ Something went wrong processing that request. Please try again." }]);
    } finally {
      this.isProcessing.set(false);
    }
  }

  applyPreset(presetDescription: string) {
    this.sendMessage(`Apply this style: ${presetDescription}`);
  }

  // --- Utilities ---

  reset() {
    this.currentImage.set(null);
    this.originalImage.set(null);
    this.chatMessages.set([{ role: 'model', text: "Fresh start! Upload a photo." }]);
  }

  downloadImage() {
    const link = document.createElement('a');
    link.download = `nano-banana-edit-${Date.now()}.jpg`;
    link.href = this.currentImage()!;
    link.click();
  }

  showOriginal() {
    if (this.originalImage()) {
      // We temporarily point the img src to original, but don't lose the generated one
      // Wait, let's just use a temp signal or direct DOM manipulation? 
      // Actually, Angular binding is fast enough.
      // But we need to store the generated one to switch back.
      // Let's implement a 'viewingImage' approach?
      // Simpler: Just swap the ref for the duration of the hold?
      // No, that triggers state changes.
      // Let's rely on the template binding. We need a way to know WHICH to show.
      // The template uses `currentImage()`.
      // We will override `currentImage` temporarily? No, that's messy.
      
      // Let's use a temporary override via a view child?
      // Actually, the simplest way is to manipulate the DOM directly for "Quick Compare" to avoid large re-renders.
      const img = document.querySelector('img[alt="Workspace"]') as HTMLImageElement;
      if (img && this.originalImage()) {
        img.src = this.originalImage()!;
      }
    }
  }

  showCurrent() {
    const img = document.querySelector('img[alt="Workspace"]') as HTMLImageElement;
    if (img && this.currentImage()) {
      img.src = this.currentImage()!;
    }
  }
}
