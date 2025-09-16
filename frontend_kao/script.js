document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const formSection = document.getElementById('form-section');
    const loader = document.getElementById('loader');
    const resultSection = document.getElementById('result-section');
    const menuForm = document.getElementById('menu-form');
    const tagsContainer = document.getElementById('ingredient-tags');
    const input = document.getElementById('ingredient-input');
    const saveMenuBtn = document.getElementById('save-menu-btn');
    const savedModal = document.getElementById('saved-modal');
    const showSavedBtn = document.getElementById('show-saved-btn');
    const closeSavedModalBtn = document.getElementById('close-saved-modal');
    const savedListContainer = document.getElementById('saved-list');
    const clearSavedBtn = document.getElementById('clear-saved-btn');
    const getRecipeBtn = document.getElementById('get-recipe-btn');
    const recipeModal = document.getElementById('recipe-modal');
    const closeRecipeModalBtn = document.getElementById('close-recipe-modal');
    const recipeTitle = document.getElementById('recipe-title');
    const recipeContent = document.getElementById('recipe-content');

    // --- State Variables ---
    let ingredients = [];
    let currentMenu = {};
    let savedMenus = JSON.parse(localStorage.getItem('savedMenus')) || [];

    // --- Tag Input Logic ---
    function createTag(label) {
        const div = document.createElement('div');
        div.setAttribute('class', 'tag');
        div.innerHTML = `${label} <span class="remove-tag" data-label="${label}">x</span>`;
        return div;
    }
    function resetTags() { tagsContainer.innerHTML = ''; }
    function addTags() {
        resetTags();
        ingredients.slice().reverse().forEach(label => {
            const tag = createTag(label);
            tagsContainer.prepend(tag);
        });
    }
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const label = input.value.trim();
            if (label && !ingredients.includes(label)) {
                ingredients.push(label);
                addTags();
                input.value = '';
            }
        }
    });
    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag')) {
            const label = e.target.getAttribute('data-label');
            ingredients = ingredients.filter(ing => ing !== label);
            addTags();
        }
    });

    // --- Saved Menu Functionality ---
    function displaySavedMenus() {
        savedListContainer.innerHTML = '';
        if (savedMenus.length === 0) {
            savedListContainer.innerHTML = '<p style="text-align:center; color:#888;">ยังไม่มีเมนูที่บันทึกไว้</p>';
            return;
        }
        savedMenus.forEach(menu => {
            const item = document.createElement('div');
            item.className = 'saved-item';
            item.innerHTML = `
                <img id="menu-image" alt="ภาพเมนูอาหาร" onerror="this.src='placeholder-food.jpg';">
                <div><h4>${menu.menuName}</h4><p>${menu.description}</p></div>
            `;
            item.onclick = () => {
                currentMenu = menu;
                document.getElementById('menu-name').innerText = currentMenu.menuName;
                document.getElementById('menu-description').innerText = currentMenu.description;
                document.getElementById('menu-image').src = currentMenu.imageUrl;
                formSection.style.display = 'none';
                loader.style.display = 'none';
                resultSection.style.display = 'block';
                savedModal.style.display = 'none';
            };
            savedListContainer.appendChild(item);
        });
    }

    // --- Form Submission Logic ---
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (ingredients.length === 0) {
            alert('กรุณาใส่ส่วนผสมอย่างน้อย 1 อย่างครับ');
            return;
        }
        const dataToSend = {
            ingredients: ingredients,
            style: document.getElementById('cuisine-style').value,
            method: document.getElementById('cooking-method').value
        };
        formSection.style.display = 'none';
        loader.style.display = 'block';
        resultSection.style.display = 'none';
        try {
            const response = await fetch('http://52.205.5.159:3000/generate-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error');
            }
            currentMenu = await response.json();
            document.getElementById('menu-name').innerText = currentMenu.menuName;
            document.getElementById('menu-description').innerText = currentMenu.description;
            document.getElementById('menu-image').src = currentMenu.imageUrl;
            loader.style.display = 'none';
            resultSection.style.display = 'block';
        } catch (error) {
            console.error('Error:', error);
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
            loader.style.display = 'none';
            formSection.style.display = 'block';
        }
    });

    // --- "Get Recipe" Button Logic (FIXED) ---
getRecipeBtn.addEventListener('click', () => {
    // --- THIS IS THE FIX ---
    // Check if a menu has been generated first
    if (!currentMenu || !currentMenu.recipe) {
        alert('Please generate a menu first before trying to see the recipe.');
        return; // Stop the function here
    }
    // --- END OF FIX ---

    recipeTitle.innerText = `สูตรสำหรับ: ${currentMenu.menuName}`;

    // Create an unordered list (bullets) for ingredients
    const ingredientsHtml = `<h4>ส่วนผสม:</h4><ul>` +
        currentMenu.recipe.ingredients.split('\\n').map(item => `<li>${item}</li>`).join('') +
        `</ul>`;

    // Create an ordered list (numbers) for instructions
    const instructionsHtml = `<h4>วิธีทำ:</h4><ol>` +
        currentMenu.recipe.instructions.split('\\n').map(item => `<li>${item}</li>`).join('') +
        `</ol>`;

    recipeContent.innerHTML = ingredientsHtml + instructionsHtml;
    recipeModal.style.display = 'block';
});

    // --- Event Listeners for Buttons & Modals ---
    saveMenuBtn.addEventListener('click', () => {
        const isAlreadySaved = savedMenus.some(menu => menu.menuName === currentMenu.menuName);
        if (currentMenu.menuName && !isAlreadySaved) {
            savedMenus.push(currentMenu);
            localStorage.setItem('savedMenus', JSON.stringify(savedMenus));
            alert('บันทึกเมนูเรียบร้อยแล้ว!');
        } else if (isAlreadySaved) {
            alert('เมนูนี้ถูกบันทึกไว้แล้ว');
        }
    });
    showSavedBtn.addEventListener('click', () => {
        displaySavedMenus();
        savedModal.style.display = "block";
    });
    clearSavedBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการล้างเมนูที่บันทึกไว้ทั้งหมดหรือไม่?')) {
            savedMenus = [];
            localStorage.removeItem('savedMenus');
            displaySavedMenus();
        }
    });
    document.getElementById('try-again').addEventListener('click', () => {
        formSection.style.display = 'block';
        loader.style.display = 'none';
        resultSection.style.display = 'none';
        ingredients = [];
        addTags();
        menuForm.reset();
    });

    // --- Modal Closing Logic ---
    closeSavedModalBtn.addEventListener('click', () => { savedModal.style.display = "none"; });
    closeRecipeModalBtn.addEventListener('click', () => { recipeModal.style.display = "none"; });
    window.addEventListener('click', (event) => {
        if (event.target == savedModal) savedModal.style.display = "none";
        if (event.target == recipeModal) recipeModal.style.display = "none";
    });
});