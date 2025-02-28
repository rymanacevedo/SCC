// CustomParagraphNode.ts
import {
  type EditorConfig,
  type SerializedParagraphNode,
  ParagraphNode,
} from 'lexical';

// Extend the serialized type to include the custom className
export type SerializedCustomParagraphNode = SerializedParagraphNode & {
  className: string;
};

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

  // Import JSON to create a new instance of the node.
  static importJSON(
    serializedNode: SerializedCustomParagraphNode,
  ): CustomParagraphNode {
    // Create a new custom paragraph node with the className from the JSON.
    const node = $createCustomParagraphNode(serializedNode.className || '');
    // Import base properties.
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
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
