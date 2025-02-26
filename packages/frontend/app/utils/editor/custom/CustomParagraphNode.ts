// CustomParagraphNode.ts
import { type EditorConfig, ParagraphNode } from 'lexical';

export class CustomParagraphNode extends ParagraphNode {
  __className: string;

  constructor(className = '', key?: string) {
    super(key);
    this.__className = className;
  }

  static getType(): string {
    return 'custom-paragraph';
  }

  static clone(node: CustomParagraphNode): CustomParagraphNode {
    return new CustomParagraphNode(node.__className, node.__key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    if (this.__className) {
      element.className = this.__className;
    }
    return element;
  }

  updateDOM(
    prevNode: CustomParagraphNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__className !== this.__className) {
      dom.className = this.__className;
      return true;
    }
    return updated;
  }

  setClassName(className: string): void {
    const self = this.getWritable();
    self.__className = className;
  }
}

export function $createCustomParagraphNode(
  className = '',
): CustomParagraphNode {
  return new CustomParagraphNode(className);
}
