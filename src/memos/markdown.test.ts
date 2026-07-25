import { describe, expect, it } from 'vitest';
import {
  applyMemoMarkdownFormat,
  continueMemoOrderedList,
  isMemoMarkdownFormatActive,
  normalizeMemoOrderedLists,
} from './markdown';

describe('applyMemoMarkdownFormat', () => {
  it('wraps the selected text and keeps the inner text selected', () => {
    expect(applyMemoMarkdownFormat('课程 001101', 3, 9, 'bold')).toEqual({
      text: '课程 **001101**',
      selectionStart: 5,
      selectionEnd: 11,
    });
  });

  it('inserts a replaceable Chinese placeholder when the selection is empty', () => {
    expect(applyMemoMarkdownFormat('', 0, 0, 'bold')).toEqual({
      text: '**加粗文字**',
      selectionStart: 2,
      selectionEnd: 6,
    });
  });

  it('formats every selected line as an unordered list', () => {
    expect(applyMemoMarkdownFormat('第一行\n第二行', 0, 7, 'unordered-list')).toEqual({
      text: '- 第一行\n- 第二行',
      selectionStart: 0,
      selectionEnd: 11,
    });
  });

  it('continues numbering when an ordered item is formatted after an existing item', () => {
    expect(applyMemoMarkdownFormat('1. first\nsecond', 9, 15, 'ordered-list')).toEqual({
      text: '1. first\n2. second',
      selectionStart: 9,
      selectionEnd: 18,
    });
  });

  it('formats every selected line as a task list', () => {
    expect(applyMemoMarkdownFormat('选课\n退课', 0, 5, 'task-list')).toEqual({
      text: '- [ ] 选课\n- [ ] 退课',
      selectionStart: 0,
      selectionEnd: 17,
    });
  });

  it('inserts a link and selects its URL placeholder', () => {
    expect(applyMemoMarkdownFormat('官网', 0, 2, 'link')).toEqual({
      text: '[官网](https://)',
      selectionStart: 5,
      selectionEnd: 13,
    });
  });

  it('removes an inline format when the same action is applied again', () => {
    const formatted = applyMemoMarkdownFormat('课程 001101', 3, 9, 'bold');

    expect(
      applyMemoMarkdownFormat(
        formatted.text,
        formatted.selectionStart,
        formatted.selectionEnd,
        'bold',
      ),
    ).toEqual({
      text: '课程 001101',
      selectionStart: 3,
      selectionEnd: 9,
    });
  });

  it('removes a line format when all selected lines already use it', () => {
    const formatted = applyMemoMarkdownFormat('选课\n退课', 0, 5, 'task-list');

    expect(
      applyMemoMarkdownFormat(
        formatted.text,
        formatted.selectionStart,
        formatted.selectionEnd,
        'task-list',
      ),
    ).toEqual({
      text: '选课\n退课',
      selectionStart: 0,
      selectionEnd: 5,
    });
  });

  it('removes a generated link when its URL is selected and link is applied again', () => {
    const formatted = applyMemoMarkdownFormat('官网', 0, 2, 'link');

    expect(
      applyMemoMarkdownFormat(
        formatted.text,
        formatted.selectionStart,
        formatted.selectionEnd,
        'link',
      ),
    ).toEqual({
      text: '官网',
      selectionStart: 0,
      selectionEnd: 2,
    });
  });
});

describe('normalizeMemoOrderedLists', () => {
  it('replaces repeated markdown list markers with visible sequential numbers', () => {
    expect(normalizeMemoOrderedLists('1. first\n1. second\n1. third', 27, 27)).toEqual({
      text: '1. first\n2. second\n3. third',
      selectionStart: 27,
      selectionEnd: 27,
    });
  });

  it('keeps a custom starting number and adjusts the selection for wider numbers', () => {
    expect(normalizeMemoOrderedLists('9. a\n9. b\n9. c', 14, 14)).toEqual({
      text: '9. a\n10. b\n11. c',
      selectionStart: 16,
      selectionEnd: 16,
    });
  });
});

describe('continueMemoOrderedList', () => {
  it('inserts the next visible number when Enter is pressed in an ordered item', () => {
    expect(continueMemoOrderedList('1. 第一项', 6, 6)).toEqual({
      text: '1. 第一项\n2. ',
      selectionStart: 10,
      selectionEnd: 10,
    });
  });

  it('renumbers following items when a new item is inserted in the middle', () => {
    expect(continueMemoOrderedList('1. abcd\n2. next', 5, 5)).toEqual({
      text: '1. ab\n2. cd\n3. next',
      selectionStart: 9,
      selectionEnd: 9,
    });
  });

  it('exits the ordered list when Enter is pressed on an empty item', () => {
    expect(continueMemoOrderedList('1. 第一项\n2. ', 10, 10)).toEqual({
      text: '1. 第一项\n',
      selectionStart: 7,
      selectionEnd: 7,
    });
  });
});

describe('isMemoMarkdownFormatActive', () => {
  it('detects the inline format surrounding the selection without confusing bold for italic', () => {
    expect(isMemoMarkdownFormatActive('课程 **001101**', 5, 11, 'bold')).toBe(true);
    expect(isMemoMarkdownFormatActive('课程 **001101**', 5, 11, 'italic')).toBe(false);
  });

  it('detects a formatted line and a generated link selection', () => {
    expect(isMemoMarkdownFormatActive('- [ ] 选课', 6, 8, 'task-list')).toBe(true);
    expect(isMemoMarkdownFormatActive('[官网](https://)', 5, 13, 'link')).toBe(true);
  });
});
