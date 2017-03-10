'use babel';

export default class TheraDebuggerView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('thera-debugger');

    // Create hidden view container.
    this.hiddenContainer = document.createElement('div');
    this.hiddenContainer.classList.add('thera-debugger-container-hidden');
    this.element.appendChild(this.hiddenContainer);

    // Create message element
    // const message = document.createElement('div');
    // message.textContent = 'The TheraDebugger package is Alive! It\'s ALIVE!';
    // message.classList.add('message');
    // this.element.appendChild(message);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  getHiddenContainer() {
    return this.hiddenContainer;
  }
}
