// DOM 요소 참조
const todoInput = document.getElementById("todo-input");
const categorySelect = document.getElementById("category-select");
const addBtn = document.getElementById("add-btn");
const inputError = document.getElementById("input-error");
const autoCategoryHint = document.getElementById("auto-category-hint");
const filterTabs = document.querySelectorAll(".filter-tab");
const todoList = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const progressBarFill = document.getElementById("progress-bar-fill");
const progressText = document.getElementById("progress-text");
const storageWarning = document.getElementById("storage-warning");

const CATEGORIES = ["업무", "개인", "공부"];
const STORAGE_KEY = "todo-list";

// 카테고리별 자동 분류 키워드 (앞쪽 카테고리가 우선순위를 가짐)
const CATEGORY_KEYWORDS = {
  업무: ["회의", "보고서", "프로젝트", "미팅", "이메일", "발표", "출장", "계약", "클라이언트", "회사", "야근", "결재", "기획"],
  공부: ["공부", "시험", "과제", "강의", "수업", "독서", "책", "학습", "논문", "자격증", "복습", "예습"],
  개인: ["운동", "병원", "쇼핑", "청소", "요리", "여행", "가족", "친구", "약속", "취미", "은행", "빨래"],
};

// 데이터 (localStorage에 STORAGE_KEY로 저장/복원)
let todos = [];
let nextId = 1;
let currentFilter = "전체";
let editingId = null;
let deleteConfirmId = null;
let categoryManuallyChanged = false; // 추가 폼에서 사용자가 직접 카테고리를 고르면 자동 분류를 멈춤
let editCategoryManuallyChanged = false; // 편집 폼에서도 동일하게 동작

// 임시 키로 실제 쓰기를 시도해 localStorage 사용 가능 여부를 한 번만 확인
function isStorageAvailable() {
  try {
    const testKey = "__todo-list-storage-test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

function showStorageWarning() {
  storageWarning.hidden = false;
}

// 현재 todos를 localStorage에 저장 (실패 시 경고 배너만 띄우고 계속 진행)
function saveTodos() {
  if (!storageAvailable) {
    showStorageWarning();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {
    showStorageWarning();
  }
}

// 페이지 로드 시 저장된 todos를 복원하고, id 충돌이 없도록 nextId를 갱신
function loadTodos() {
  if (!storageAvailable) {
    showStorageWarning();
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    todos = parsed;
    nextId = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  } catch (e) {
    showStorageWarning();
  }
}

// 새 할 일 객체 생성
function createTodo(text, category) {
  return {
    id: nextId++,
    text,
    category,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

// 사용자 입력을 HTML로 그대로 삽입해도 안전하도록 이스케이프 (XSS 방지)
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 카테고리 태그 마크업 (목록/삭제확인 뷰에서 공통으로 사용)
function categoryTagHtml(category) {
  return `<span class="category-tag" data-category="${category}">${category}</span>`;
}

// 텍스트에 포함된 키워드로 카테고리를 추정 (일치하는 키워드가 없으면 null)
function classifyCategory(text) {
  for (const category of CATEGORIES) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => text.includes(keyword))) {
      return category;
    }
  }
  return null;
}

function showInputError(message) {
  inputError.textContent = message;
  inputError.hidden = false;
}

function hideInputError() {
  inputError.hidden = true;
}

// 입력값 검증 후 새 할 일을 추가하고 저장/렌더링
function handleAddTodo() {
  const text = todoInput.value.trim();
  if (!text) {
    showInputError("할 일을 입력해주세요");
    todoInput.focus();
    return;
  }
  hideInputError();
  todos.push(createTodo(text, categorySelect.value));
  todoInput.value = "";
  todoInput.focus();
  categoryManuallyChanged = false;
  autoCategoryHint.hidden = true;
  saveTodos();
  render();
}

// 할 일 하나를 상태(기본/편집/삭제확인)에 맞는 <li>로 렌더링
function renderTodoItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item" + (todo.completed ? " completed" : "");
  li.dataset.id = todo.id;

  if (editingId === todo.id) {
    li.classList.add("editing");
    li.innerHTML = `
      <input type="text" class="edit-input" value="${escapeHtml(todo.text)}" />
      <select class="edit-category">
        ${CATEGORIES.map(
          (c) => `<option value="${c}" ${c === todo.category ? "selected" : ""}>${c}</option>`
        ).join("")}
      </select>
      <button type="button" class="save-btn" data-action="save-edit">저장</button>
      <button type="button" class="cancel-btn" data-action="cancel-edit">취소</button>
    `;
    return li;
  }

  if (deleteConfirmId === todo.id) {
    li.innerHTML = `
      ${categoryTagHtml(todo.category)}
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <div class="todo-actions">
        <span class="confirm-text">삭제할까요?</span>
        <button type="button" class="confirm-delete-btn" data-action="confirm-delete">삭제</button>
        <button type="button" class="confirm-cancel-btn" data-action="cancel-delete">취소</button>
      </div>
    `;
    return li;
  }

  li.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} />
    ${categoryTagHtml(todo.category)}
    <span class="todo-text">${escapeHtml(todo.text)}</span>
    <div class="todo-actions">
      <button type="button" class="icon-btn edit-btn" data-action="edit" title="수정">✎</button>
      <button type="button" class="icon-btn delete-btn" data-action="delete" title="삭제">✕</button>
    </div>
  `;
  return li;
}

// 진행률 바/텍스트를 필터와 무관하게 전체 todos 기준으로 갱신
function renderProgress() {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressBarFill.style.width = percent + "%";
  progressText.textContent = `${completed}/${total} 완료`;
}

// 현재 필터/편집/삭제확인 상태를 기준으로 목록 전체를 다시 그림
function render() {
  // 완료 항목은 하단으로, 그 외 상대 순서는 유지 (안정 정렬)
  const filtered = (
    currentFilter === "전체" ? todos : todos.filter((t) => t.category === currentFilter)
  ).slice().sort((a, b) => Number(a.completed) - Number(b.completed));

  todoList.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    filtered.forEach((todo) => todoList.appendChild(renderTodoItem(todo)));
  }

  renderProgress();

  if (editingId !== null) {
    const editInput = todoList.querySelector(
      `.todo-item[data-id="${editingId}"] .edit-input`
    );
    if (editInput) {
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
  }
}

// 인라인 편집 값을 검증 후 반영하고 저장/렌더링
function saveEdit(li, id) {
  const newText = li.querySelector(".edit-input").value.trim();
  const newCategory = li.querySelector(".edit-category").value;
  if (!newText) {
    li.querySelector(".edit-input").focus();
    return;
  }
  const todo = todos.find((t) => t.id === id);
  todo.text = newText;
  todo.category = newCategory;
  editingId = null;
  saveTodos();
  render();
}

addBtn.addEventListener("click", handleAddTodo);

todoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleAddTodo();
  }
});

todoInput.addEventListener("input", () => {
  if (!inputError.hidden) hideInputError();

  const text = todoInput.value.trim();
  if (!text) {
    categoryManuallyChanged = false;
    autoCategoryHint.hidden = true;
    return;
  }
  if (categoryManuallyChanged) return;

  const detected = classifyCategory(text);
  if (detected) {
    categorySelect.value = detected;
    autoCategoryHint.hidden = false;
  } else {
    autoCategoryHint.hidden = true;
  }
});

categorySelect.addEventListener("change", () => {
  categoryManuallyChanged = true;
  autoCategoryHint.hidden = true;
});

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.category;
    editingId = null;
    deleteConfirmId = null;
    filterTabs.forEach((t) => t.classList.toggle("active", t === tab));
    render();
  });
});

todoList.addEventListener("click", (e) => {
  const li = e.target.closest(".todo-item");
  if (!li) return;
  const id = Number(li.dataset.id);
  const action = e.target.dataset.action;

  if (action === "edit" || e.target.classList.contains("todo-text")) {
    editingId = id;
    deleteConfirmId = null;
    editCategoryManuallyChanged = false;
    render();
  } else if (action === "delete") {
    deleteConfirmId = id;
    render();
  } else if (action === "confirm-delete") {
    todos = todos.filter((t) => t.id !== id);
    deleteConfirmId = null;
    saveTodos();
    render();
  } else if (action === "cancel-delete") {
    deleteConfirmId = null;
    render();
  } else if (action === "save-edit") {
    saveEdit(li, id);
  } else if (action === "cancel-edit") {
    editingId = null;
    render();
  }
});

todoList.addEventListener("change", (e) => {
  if (e.target.classList.contains("todo-checkbox")) {
    const li = e.target.closest(".todo-item");
    const id = Number(li.dataset.id);
    const todo = todos.find((t) => t.id === id);
    todo.completed = e.target.checked;
    saveTodos();
    render();
  } else if (e.target.classList.contains("edit-category")) {
    editCategoryManuallyChanged = true;
  }
});

todoList.addEventListener("input", (e) => {
  if (!e.target.classList.contains("edit-input")) return;
  if (editCategoryManuallyChanged) return;

  const text = e.target.value.trim();
  const detected = text && classifyCategory(text);
  if (!detected) return;

  const li = e.target.closest(".todo-item");
  li.querySelector(".edit-category").value = detected;
});

todoList.addEventListener("keydown", (e) => {
  if (!e.target.classList.contains("edit-input")) return;
  const li = e.target.closest(".todo-item");
  const id = Number(li.dataset.id);
  if (e.key === "Enter") {
    e.preventDefault();
    saveEdit(li, id);
  } else if (e.key === "Escape") {
    editingId = null;
    render();
  }
});

loadTodos();
render();
