(() => {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('hero')?.toLowerCase();

  const images = {
    starter: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-1.webp',
    burger: 'wp-content/uploads/2026/05/BURGUER.webp',
    burgerAlt: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-2.webp',
    minis: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/MINIS.webp',
    bocas: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-3.webp',
    pizza: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/OVEN.webp',
    drink1: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-1.webp',
    drink2: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-2.webp',
    drink3: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-3.webp',
    drink4: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-4.webp',
    wine: 'wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-5.webp'
  };

  const categories = [
    { id: 'entradas', es: 'Entradas', en: 'Starters', esDescription: 'Para abrir la mesa y compartir.', enDescription: 'Small plates made for sharing.' },
    { id: 'burgers', es: 'Hamburguesas y nachos', en: 'Burgers & nachos', esDescription: 'Clásicos de la casa con carácter.', enDescription: 'House classics with plenty of character.' },
    { id: 'minis', es: 'Mini hamburguesas y alitas', en: 'Mini burgers & wings', esDescription: 'Bocados informales para compartir.', enDescription: 'Casual bites made for the table.' },
    { id: 'bocas', es: 'Bocas costarricenses', en: 'Costa Rican bites', esDescription: 'Sabores locales para pedir al centro.', enDescription: 'Local flavours for the whole table.' },
    { id: 'pizzas', es: 'Pizzas', en: 'Pizzas', esDescription: 'Ocho porciones para una noche larga.', enDescription: 'Eight slices for a long evening.' },
    { id: 'postres', es: 'Postres', en: 'Desserts', esDescription: 'El cierre dulce de la carta.', enDescription: 'A sweet finish to the menu.' },
    { id: 'bebidas', es: 'Bebidas', en: 'Drinks', esDescription: 'La selección sin alcohol se confirma en mesa.', enDescription: 'Ask your server about today’s soft drinks.' },
    { id: 'vinos', es: 'Vinos', en: 'Wine', esDescription: 'Copas para acompañar cada plato.', enDescription: 'Wine by the glass for every plate.' },
    { id: 'autor', es: 'Cócteles de autor', en: 'Signature cocktails', esDescription: 'Mezclas de la casa con espíritu nocturno.', enDescription: 'House mixes for the evening.' },
    { id: 'gin', es: 'Gin tonic', en: 'Gin & tonic', esDescription: 'Clásicos y selecciones premium.', enDescription: 'Classic and premium pours.' },
    { id: 'rones', es: 'Rones', en: 'Rum', esDescription: 'Selección por trago; consulta el precio.', enDescription: 'Pours by the glass; ask for today’s price.' },
    { id: 'tequila', es: 'Tequila', en: 'Tequila', esDescription: 'Selección por trago; consulta el precio.', enDescription: 'Pours by the glass; ask for today’s price.' },
    { id: 'vodka', es: 'Vodka', en: 'Vodka', esDescription: 'Selección por trago; consulta el precio.', enDescription: 'Pours by the glass; ask for today’s price.' },
    { id: 'whisky', es: 'Whisky', en: 'Whisky', esDescription: 'Selección por trago; consulta el precio.', enDescription: 'Pours by the glass; ask for today’s price.' }
  ];

  const products = [
    { id: 'calamar', category: 'entradas', nameEs: 'Calamar Frito', nameEn: 'Fried Calamari', price: 6800, image: images.starter, descEs: 'Calamares empanizados con alioli de hierbas, cilantro, pesto y cebolla roja marinada en limón.', descEn: 'Breaded calamari with herb aioli, cilantro, pesto and red onion marinated in lime.', tags: ['recommended'] },
    { id: 'choripan', category: 'entradas', nameEs: 'Choripán de Chorizo de Cordero', nameEn: 'Lamb Chorizo Choripán', price: 5850, image: images.burgerAlt, descEs: 'Chorizo de cordero, alioli de hierbas, mostaza y chimichurri argentino con papas fritas.', descEn: 'Lamb chorizo with herb aioli, mustard, Argentinian chimichurri and french fries.', tags: ['share'] },
    { id: 'papas-trufadas', category: 'entradas', nameEs: 'Papas Trufadas', nameEn: 'Truffled Potatoes', price: 4850, image: images.bocas, descEs: 'Papas finas fritas con aceite de trufa y queso parmesano.', descEn: 'Thin fries drizzled with truffle oil and Parmesan cheese.', tags: ['vegetarian'] },
    { id: 'papas-bravas', category: 'entradas', nameEs: 'Papas Bravas', nameEn: 'Patatas Bravas', price: 4200, image: images.bocas, descEs: 'Papas gajo con alioli de ajo, chile morrón y salsa brava.', descEn: 'Potato wedges with garlic aioli, bell pepper and brava sauce.', tags: ['vegetarian', 'spicy'] },
    { id: 'nachos', category: 'entradas', nameEs: 'Chilli Cheese Nachos', nameEn: 'Chilli Cheese Nachos', price: 6500, image: images.starter, descEs: 'Chilli con carne, frijoles, guacamole, natilla, queso fundido y jalapeños.', descEn: 'Beef chilli, refried beans, guacamole, sour cream, melted cheese and jalapeños.', tags: ['share', 'spicy'] },

    { id: 'bocca-burger', category: 'burgers', nameEs: 'Hamburguesa Bocca', nameEn: 'Bocca Burger', price: 8600, image: images.burger, descEs: 'Carne Angus, salsa de la casa, cheddar, aros de cebolla, tocineta, lechuga y tomate con papas.', descEn: 'Angus beef, house sauce, cheddar, onion rings, bacon, lettuce and tomato with fries.', tags: ['recommended'] },
    { id: 'double-burger', category: 'burgers', nameEs: 'Doble Quesoburguesa', nameEn: 'Double Cheeseburger', price: 7900, image: images.burgerAlt, descEs: 'Doble torta Angus, salsa especial, cheddar y pepinillos con papas fritas.', descEn: 'Double Angus patty, special sauce, cheddar and pickles with french fries.', tags: [] },
    { id: 'american-burger', category: 'burgers', nameEs: 'Hamburguesa Americana', nameEn: 'American Hamburger', price: 8900, image: images.burger, descEs: 'Carne Angus, cheddar, mermelada de tocino, pepinillos, cebolla, ketchup y mostaza.', descEn: 'Angus beef, cheddar, bacon jam, pickles, onion, ketchup and mustard.', tags: [] },
    { id: 'tica-burga', category: 'burgers', nameEs: 'Tica Burga', nameEn: 'Tica Burger', price: 13500, image: images.burgerAlt, descEs: 'Carne rellena de queso y tocino, jamón, queso amarillo, cebolla caramelizada y frijoles molidos.', descEn: 'Beef patty filled with cheese and bacon, ham, yellow cheese, caramelized onion and refried beans.', tags: ['recommended'] },

    { id: 'mini-chicken', category: 'minis', nameEs: 'Mini Hamburguesas de Pollo', nameEn: 'Mini Chicken Burgers', price: 5950, image: images.minis, descEs: 'Pollo empanizado con salsa búfalo, ranch, lechuga, tomate y cebolla.', descEn: 'Breaded chicken with buffalo sauce, ranch, lettuce, tomato and onion.', tags: ['spicy'] },
    { id: 'mini-lamb', category: 'minis', nameEs: 'Mini Hamburguesas de Cordero', nameEn: 'Mini Lamb Burgers', price: 6250, image: images.minis, descEs: 'Cordero, mozzarella y cebolla caramelizada al vino tinto con papas.', descEn: 'Ground lamb, mozzarella and red-wine caramelized onion with fries.', tags: [] },
    { id: 'mini-pork', category: 'minis', nameEs: 'Mini Hamburguesas de Pulled Pork', nameEn: 'Mini Pulled Pork Burgers', price: 5950, image: images.minis, descEs: 'Pulled pork con salsa BBQ, coleslaw y papas fritas.', descEn: 'Pulled pork with BBQ sauce, coleslaw and french fries.', tags: ['share'] },
    { id: 'wings', category: 'minis', nameEs: 'Alitas de Pollo', nameEn: 'Chicken Wings', price: 6800, image: images.bocas, descEs: 'Alitas empanizadas con papas y salsa BBQ, ranch, búfalo o mostaza miel.', descEn: 'Breaded wings with fries and BBQ, ranch, buffalo or honey mustard sauce.', tags: ['share'] },

    { id: 'fish-gallo', category: 'bocas', nameEs: 'Gallo de Pescado', nameEn: 'Fish Gallo', price: 4800, image: images.starter, descEs: 'Pescado empanizado, cebolla morada encurtida, limón, cilantro y alioli con tortillas de maíz.', descEn: 'Breaded fish, pickled red onion, lime, cilantro and aioli with corn tortillas.', tags: [] },
    { id: 'skirt-gallo', category: 'bocas', nameEs: 'Gallo de Entraña', nameEn: 'Skirt Steak Gallo', price: 5400, image: images.bocas, descEs: 'Entraña USDA, pico de gallo, frijoles molidos, cebolla encurtida y salsas de la casa.', descEn: 'USDA skirt steak, pico de gallo, refried beans, pickled onion and house sauces.', tags: ['recommended'] },
    { id: 'pork-gallo', category: 'bocas', nameEs: 'Gallo de Chicharrón', nameEn: 'Pork Belly Gallo', price: 4800, image: images.bocas, descEs: 'Chicharrón en miel picante, cebolla encurtida y tortillas de maíz.', descEn: 'Pork belly in spicy honey with pickled onion and corn tortillas.', tags: ['spicy'] },
    { id: 'chorizo-gallo', category: 'bocas', nameEs: 'Gallo de Chorizo', nameEn: 'Chorizo Gallo', price: 4500, image: images.bocas, descEs: 'Chorizo, chimichurri, frijoles molidos, pico de gallo y bastones de yuca.', descEn: 'Chorizo, chimichurri, refried beans, pico de gallo and yucca sticks.', tags: [] },
    { id: 'short-ribs-gallo', category: 'bocas', nameEs: 'Short Ribs Gallo', nameEn: 'Short Ribs Gallo', price: 5850, image: images.bocas, descEs: 'Cocción lenta de ocho horas con mozzarella gratinada y chile serrano.', descEn: 'Eight-hour slow-cooked short ribs with melted mozzarella and serrano pepper.', tags: ['recommended', 'spicy'] },
    { id: 'surf-turf-gallo', category: 'bocas', nameEs: 'Gallo de Mar y Tierra', nameEn: 'Surf and Turf Gallo', price: 6200, image: images.bocas, descEs: 'Lomito, rib eye USDA y camarones con frijoles, pico de gallo, alioli y cilantro.', descEn: 'Tenderloin, USDA rib eye and shrimp with beans, pico de gallo, aioli and cilantro.', tags: [] },
    { id: 'chifrijo', category: 'bocas', nameEs: 'Chifrijo', nameEn: 'Chifrijo', price: 5200, image: images.bocas, descEs: 'Pancetta de cerdo, arroz, frijoles tiernos, pico de gallo, guacamole y chips.', descEn: 'Pork belly, rice, tender beans, pico de gallo, guacamole and tortilla chips.', tags: ['share'] },
    { id: 'patacones', category: 'bocas', nameEs: 'Patacones', nameEn: 'Patacones', price: 5600, image: images.bocas, descEs: 'Canastas de plátano verde, frijoles, pico de gallo, pulled pork BBQ y mayonesa de ajo.', descEn: 'Green plantain baskets, beans, pico de gallo, BBQ pulled pork and garlic mayo.', tags: ['share'] },
    { id: 'pargo', category: 'bocas', nameEs: 'Pargo Rojo Frito Entero', nameEn: 'Whole Fried Red Snapper', price: 10500, image: images.starter, descEs: 'Pargo con tortillas, frijoles, pico de gallo, guacamole y patacones.', descEn: 'Red snapper with tortillas, beans, pico de gallo, guacamole and patacones.', tags: ['share'] },

    { id: 'pizza-toscana', category: 'pizzas', nameEs: 'Pizza Toscana', nameEn: 'Tuscan Pizza', price: 11850, image: images.pizza, descEs: 'Prosciutto, tomates frescos, orégano, arúgula, cebolla, pimientos y Grana Padano.', descEn: 'Prosciutto, fresh tomato, oregano, arugula, onion, peppers and Grana Padano.', tags: ['share'] },
    { id: 'pizza-pepperoni', category: 'pizzas', nameEs: 'Pizza Pepperoni', nameEn: 'Pepperoni Pizza', price: 8950, image: images.pizza, descEs: 'Combinación de quesos, tomate natural y pepperoni.', descEn: 'A combination of cheeses, natural tomato and pepperoni.', tags: ['share'] },
    { id: 'pizza-suprema', category: 'pizzas', nameEs: 'Pizza Suprema Boccantina', nameEn: 'Boccantina Supreme Pizza', price: 11850, image: images.pizza, descEs: 'Cebolla, pimientos, tomate natural y salchicha italiana.', descEn: 'Onion, peppers, natural tomato and Italian sausage.', tags: ['recommended', 'share'] },
    { id: 'pizza-margarita', category: 'pizzas', nameEs: 'Pizza Margarita', nameEn: 'Margherita Pizza', price: 9950, image: images.pizza, descEs: 'Tomate natural, mozzarella fresca y parmesano.', descEn: 'Natural tomato, fresh mozzarella and Parmesan.', tags: ['vegetarian', 'share'] },
    { id: 'pizza-carne', category: 'pizzas', nameEs: 'Pizza Molto Carne', nameEn: 'Molto Carne Pizza', price: 11950, image: images.pizza, descEs: 'Jamón, pepperoni, prosciutto, tocineta, salame y tomate natural.', descEn: 'Ham, pepperoni, prosciutto, bacon, salami and natural tomato.', tags: ['share'] },

    { id: 'dessert', category: 'postres', nameEs: 'Postre de la carta', nameEn: 'Menu Dessert', price: 4350, image: images.starter, descEs: 'La carta actual no indica el nombre ni los ingredientes. Confírmalo con el mesero.', descEn: 'The current menu does not list its name or ingredients. Please ask your server.', tags: [], soldOut: true },

    { id: 'house-wine', category: 'vinos', nameEs: 'Copa de Vino de la Casa', nameEn: 'House Wine by the Glass', price: 5250, image: images.wine, descEs: 'Tinto, blanco, rosado o espumante.', descEn: 'Red, white, rosé or sparkling.', tags: [] },
    { id: 'tropical-oasis', category: 'autor', nameEs: 'Tropical Oasis', nameEn: 'Tropical Oasis', price: 6000, image: images.drink4, descEs: 'Tequila, licor de melón, limón y jugo de piña.', descEn: 'Tequila, melon liqueur, lime and pineapple juice.', tags: ['recommended'] },
    { id: 'jungle-bird', category: 'autor', nameEs: 'Jungle Bird', nameEn: 'Jungle Bird', price: 6000, image: images.drink2, descEs: 'Ron, Campari y jarabe de piña aromatizado con hierbas de la casa.', descEn: 'Rum, Campari and pineapple syrup infused with house herbs.', tags: [] },
    { id: 'bramble', category: 'autor', nameEs: 'Bramble 2.0', nameEn: 'Bramble 2.0', price: 6000, image: images.drink1, descEs: 'Ginebra, jarabe de mora, limón y crema de cassis.', descEn: 'Gin, blackberry syrup, lime and crème de cassis.', tags: [], soldOut: true },
    { id: 'aperol', category: 'autor', nameEs: 'Aperol Spritz', nameEn: 'Aperol Spritz', price: 5420, image: images.drink4, descEs: 'Aperol, prosecco, soda y naranja.', descEn: 'Aperol, prosecco, soda and orange.', tags: [] },
    { id: 'sangria', category: 'autor', nameEs: 'Sangría', nameEn: 'Sangria', price: 5420, image: images.drink3, descEs: 'Vino tinto, manzana, canela, limón y ron.', descEn: 'Red wine, apple, cinnamon, lime and rum.', tags: ['share'] },
    { id: 'gin-tonic', category: 'gin', nameEs: 'Gin Tonic', nameEn: 'Gin & Tonic', price: 5420, image: images.drink3, descEs: 'Limón, naranja o frutos rojos.', descEn: 'Lime, orange or red berries.', tags: [] },
    { id: 'gin-premium', category: 'gin', nameEs: 'Gin Tonic Premium', nameEn: 'Premium Gin & Tonic', price: 7200, image: images.drink1, descEs: 'Hendricks o Bulldog con tónica premium.', descEn: 'Hendricks or Bulldog with premium tonic.', tags: ['recommended'] },

    { id: 'zacapa', category: 'rones', nameEs: 'Ron Zacapa 12 años', nameEn: 'Zacapa 12-year Rum', price: null, image: images.drink2, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'flor-cana', category: 'rones', nameEs: 'Flor de Caña 7 años', nameEn: 'Flor de Caña 7-year Rum', price: null, image: images.drink2, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'don-julio', category: 'tequila', nameEs: 'Don Julio Blanco', nameEn: 'Don Julio Blanco', price: null, image: images.drink4, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'don-julio-70', category: 'tequila', nameEs: 'Don Julio 70', nameEn: 'Don Julio 70', price: null, image: images.drink4, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'titos', category: 'vodka', nameEs: 'Tito’s', nameEn: 'Tito’s', price: null, image: images.drink3, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'grey-goose', category: 'vodka', nameEs: 'Grey Goose', nameEn: 'Grey Goose', price: null, image: images.drink3, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'monkey', category: 'whisky', nameEs: 'Monkey Shoulder', nameEn: 'Monkey Shoulder', price: null, image: images.drink2, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] },
    { id: 'glenfiddich', category: 'whisky', nameEs: 'Glenfiddich 12 años', nameEn: 'Glenfiddich 12-year', price: null, image: images.drink2, descEs: 'Disponible por trago. El PDF actual no indica el precio.', descEn: 'Available by the glass. The current PDF does not list a price.', tags: [] }
  ];

  window.BoccMenuCatalog = Object.freeze({ categories, products });
  if (variant !== 'a' || params.get('embedMenu') !== '1') return;

  const copy = {
    es: {
      prototype: 'Propuesta interactiva · Hero A', title: 'La carta, a tu ritmo.', intro: 'Explora, pregunta y arma tu pedido desde la mesa. Esta experiencia es una demostración local y no envía información al restaurante.',
      table: 'Mesa 12', waiterDemo: 'Ver demostración del mesero', itemCount: 'productos', add: 'Agregar', details: 'Ver detalles', ask: 'Preguntar sobre este plato', unavailable: 'Consultar precio', soldOut: 'Agotado hoy', estimated: 'Total estimado', viewOrder: 'Ver pedido', help: 'Necesito ayuda', noItems: 'Aún no hay productos cargados en esta categoría.', noItemsHelp: 'Puedes llamar al mesero para consultar la selección disponible.', callWaiter: 'Llamar al mesero',
      orderSent: 'Pedido enviado', accepted: 'Aceptado', preparing: 'En preparación', ready: 'Listo', delivered: 'Entregado', demoLabel: 'Prototipo local · Sin pagos reales'
    },
    en: {
      prototype: 'Interactive proposal · Hero A', title: 'The menu, at your pace.', intro: 'Browse, ask questions and build your order from the table. This is a local demonstration and does not send information to the restaurant.',
      table: 'Table 12', waiterDemo: 'View waiter demonstration', itemCount: 'items', add: 'Add', details: 'View details', ask: 'Ask about this item', unavailable: 'Ask for price', soldOut: 'Sold out today', estimated: 'Estimated total', viewOrder: 'View order', help: 'I need help', noItems: 'No products have been added to this category yet.', noItemsHelp: 'Call your server to ask about today’s selection.', callWaiter: 'Call waiter',
      orderSent: 'Order sent', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', delivered: 'Delivered', demoLabel: 'Local prototype · No real payments'
    }
  };

  const filterCopy = {
    es: {
      searchLabel: 'Buscar en toda la carta',
      searchPlaceholder: 'Ej. pizza, cordero, vegetariano…',
      clearSearch: 'Borrar búsqueda',
      filterLabel: 'Filtros rápidos',
      foodFilter: 'Filtrar por comidas',
      allFoods: 'Todas las comidas',
      clearFoodFilter: 'Quitar filtro de comidas',
      foodFilterDescription: 'Platos de las categorías gastronómicas del menú.',
      all: 'Todos',
      recommended: 'Recomendados',
      share: 'Para compartir',
      vegetarian: 'Vegetarianos',
      spicy: 'Picantes',
      resultsTitle: 'Resultados de búsqueda',
      resultsDescription: 'Coincidencias en todas las categorías del menú.',
      filteredDescription: 'Selección disponible en toda la carta.',
      noResults: 'No encontramos platos con esos filtros.',
      noResultsHelp: 'Prueba con otro nombre, ingrediente o elimina los filtros activos.',
      clearFilters: 'Limpiar búsqueda y filtros'
    },
    en: {
      searchLabel: 'Search the full menu',
      searchPlaceholder: 'Try pizza, lamb, vegetarian…',
      clearSearch: 'Clear search',
      filterLabel: 'Quick filters',
      foodFilter: 'Filter by food',
      allFoods: 'All food',
      clearFoodFilter: 'Remove food filter',
      foodFilterDescription: 'Dishes from every food category on the menu.',
      all: 'All',
      recommended: 'Recommended',
      share: 'To share',
      vegetarian: 'Vegetarian',
      spicy: 'Spicy',
      resultsTitle: 'Search results',
      resultsDescription: 'Matches across every menu category.',
      filteredDescription: 'Available selections from the full menu.',
      noResults: 'No menu items match those filters.',
      noResultsHelp: 'Try another name or ingredient, or remove the active filters.',
      clearFilters: 'Clear search and filters'
    }
  };

  const extraCopy = {
    es: {
      customize: 'Personalizar', customizable: 'Personalizable', pizzaTitle: 'Personaliza tu pizza', burgerTitle: 'Personaliza tu hamburguesa',
      instruction: 'Selecciona uno o más extras. Se enviarán vinculados a este plato.',
      demoNotice: 'Los extras y precios son configurados por el restaurante.', pendingPrice: 'Precio por confirmar',
      noneSelected: 'Sin extras seleccionados', selectedSingular: '1 extra seleccionado', selectedPlural: 'extras seleccionados',
      addConfigured: 'Agregar configuración al pedido', itemExtras: 'Extras de este plato', preparationNote: 'Otra indicación de preparación',
      notePlaceholder: 'Ej. sin cebolla', priceNotice: 'Los extras con precio pendiente no modifican todavía el total.', extrasLabel: 'EXTRAS'
    },
    en: {
      customize: 'Customize', customizable: 'Customizable', pizzaTitle: 'Customize your pizza', burgerTitle: 'Customize your burger',
      instruction: 'Select one or more extras. They will be sent as part of this item.',
      demoNotice: 'Extras and prices are configured by the restaurant.', pendingPrice: 'Price to be confirmed',
      noneSelected: 'No extras selected', selectedSingular: '1 extra selected', selectedPlural: 'extras selected',
      addConfigured: 'Add configuration to order', itemExtras: 'Extras for this item', preparationNote: 'Other preparation request',
      notePlaceholder: 'E.g. no onion', priceNotice: 'Extras with a pending price do not yet change the total.', extrasLabel: 'EXTRAS'
    }
  };

  const extraConfigApi = window.BoccMenuExtrasConfig;
  const state = {
    lang: 'es',
    category: 'entradas',
    query: '',
    filter: 'all',
    foodCategory: null,
    cart: new Map(),
    order: null,
    requests: [],
    selectedProduct: null,
    selectedHelpProduct: null,
    cartNote: '',
    failedSend: false,
    nextLineNumber: 1,
    extraConfig: extraConfigApi?.load() || { products: {} }
  };

  const app = document.createElement('section');
  app.id = 'bocc-menu-app';
  app.className = 'bocc-menu-app';
  app.setAttribute('aria-labelledby', 'bocc-menu-title');
  app.innerHTML = `
    <div class="bocc-menu-app__masthead">
      <div class="bocc-menu-app__masthead-copy">
        <p class="bocc-menu-app__kicker" data-copy="prototype"></p>
        <h2 id="bocc-menu-title" data-copy="title"></h2>
        <p class="bocc-menu-app__lead" data-copy="intro"></p>
      </div>
      <div class="bocc-menu-app__utilities">
        <span class="bocc-table-badge" data-copy="table"></span>
        <button class="bocc-icon-button" type="button" data-action="toggle-language" aria-label="Cambiar idioma">EN</button>
        <button class="bocc-outline-button" type="button" data-action="open-waiter" data-copy="waiterDemo"></button>
      </div>
    </div>
    <div class="bocc-menu-app__category-wrap">
      <nav class="bocc-menu-app__categories" aria-label="Categorías del menú" data-region="categories"></nav>
    </div>
    <div class="bocc-menu-app__content">
      <section class="bocc-order-progress" data-region="order-progress" hidden></section>
      <section class="bocc-menu-tools" aria-labelledby="bocc-menu-search-label">
        <div class="bocc-menu-search">
          <label id="bocc-menu-search-label" for="bocc-menu-search" data-region="search-label"></label>
          <div class="bocc-menu-search__field">
            <svg class="bocc-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg>
            <input id="bocc-menu-search" type="search" data-field="menu-search" autocomplete="off" enterkeyhint="search" aria-controls="bocc-menu-products">
            <button type="button" data-action="clear-search" data-region="clear-search" hidden>
              <svg class="bocc-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>
            </button>
          </div>
        </div>
        <div class="bocc-menu-filters">
          <span data-region="filter-label"></span>
          <div class="bocc-menu-filter-row">
            <div data-region="food-filter"></div>
            <div class="bocc-menu-filters__list" data-region="filters" role="group"></div>
          </div>
        </div>
      </section>
      <header class="bocc-menu-app__section-heading">
        <div><h3 data-region="category-title"></h3><p data-region="category-description"></p></div>
        <span data-region="category-count" role="status" aria-live="polite" aria-atomic="true"></span>
      </header>
      <div class="bocc-product-grid" id="bocc-menu-products" data-region="products"></div>
    </div>
    <p class="bocc-demo-note" data-copy="demoLabel"></p>
    <button class="bocc-help-fab" type="button" data-action="open-help"><span aria-hidden="true">?</span><span data-copy="help"></span></button>
    <div class="bocc-cart-bar" data-region="cart-bar" hidden>
      <div><span class="bocc-cart-bar__count" data-region="cart-count"></span><strong data-region="cart-total"></strong></div>
      <button type="button" data-action="open-cart" data-copy="viewOrder"></button>
    </div>
    <div class="bocc-toast" data-region="toast" role="status" aria-live="polite" aria-atomic="true"></div>
    <div class="bocc-sr-only" data-region="live" role="status" aria-live="polite" aria-atomic="true"></div>
    <dialog class="bocc-dialog bocc-product-dialog" data-dialog="product"></dialog>
    <dialog class="bocc-dialog bocc-cart-dialog" data-dialog="cart"></dialog>
    <dialog class="bocc-dialog bocc-help-dialog" data-dialog="help"></dialog>
    <dialog class="bocc-dialog bocc-waiter-dialog" data-dialog="waiter"></dialog>`;

  const menuAnchor = document.getElementById('menu');
  const anchorSection = menuAnchor?.closest('.e-con.e-parent');
  const page = document.querySelector('.elementor.elementor-1187');
  if (!page || !anchorSection) return;

  document.body.dataset.boccantinaMenu = 'a';
  ['e7eeb2c', '52177ef'].forEach((dataId) => page.querySelector(`[data-id="${dataId}"]`)?.classList.add('bocc-original-menu'));
  anchorSection.insertAdjacentElement('afterend', app);

  const primaryHeroLink = document.querySelector('.bocc-hero--a .bocc-button--primary');
  if (primaryHeroLink) primaryHeroLink.setAttribute('href', '#bocc-menu-app');
  document.querySelectorAll('a[href]').forEach((link) => {
    try {
      const target = new URL(link.href, window.location.href);
      if (target.hash === '#menu' || target.pathname.endsWith('/wp-content/uploads/2026/09/menu.pdf')) {
        link.setAttribute('href', '#bocc-menu-app');
      }
    } catch {
      // Ignore malformed third-party links in the mirrored page.
    }
  });

  const region = (name) => app.querySelector(`[data-region="${name}"]`);
  const dialog = (name) => app.querySelector(`[data-dialog="${name}"]`);
  const t = () => copy[state.lang];
  const ft = () => filterCopy[state.lang];
  const et = () => extraCopy[state.lang];
  const productById = (id) => products.find((product) => product.id === id);
  const categoryById = (id) => categories.find((category) => category.id === id);
  const productName = (product) => state.lang === 'es' ? product.nameEs : product.nameEn;
  const productDescription = (product) => state.lang === 'es' ? product.descEs : product.descEn;
  const categoryName = (category) => category[state.lang];
  const categoryDescription = (category) => category[state.lang === 'es' ? 'esDescription' : 'enDescription'];
  const formatPrice = (price) => price === null ? t().unavailable : `₡${price.toLocaleString('en-US')}`;
  const formatExtraPrice = (price) => price === null ? et().pendingPrice : `+₡${Number(price).toLocaleString('en-US')}`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const normalizeSearch = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const customizationType = (product) => {
    const config = state.extraConfig.products[product?.id];
    return config?.enabled && config.extras.some((extra) => extra.nameEs.trim()) ? config.type : null;
  };
  const extraOptionsForProduct = (product) => customizationType(product) ? state.extraConfig.products[product.id].extras.filter((extra) => extra.nameEs.trim()) : [];
  const extraName = (extra) => state.lang === 'es' ? extra.nameEs : (extra.nameEn || extra.nameEs);
  const foodCategoryIds = ['entradas', 'burgers', 'minis', 'bocas', 'pizzas', 'postres'];
  const isDiscovering = () => Boolean(state.query.trim()) || state.filter !== 'all' || state.foodCategory !== null;
  const formatItemCount = (count) => state.lang === 'es'
    ? `${count} ${count === 1 ? 'producto' : 'productos'}`
    : `${count} ${count === 1 ? 'item' : 'items'}`;

  const icon = (name) => {
    const paths = {
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      minus: '<path d="M5 12h14"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      bag: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
      check: '<path d="m5 12 4 4L19 6"/>'
    };
    return `<svg class="bocc-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  };

  const tagLabels = {
    es: { recommended: 'Recomendado', share: 'Para compartir', vegetarian: 'Vegetariano', spicy: 'Picante' },
    en: { recommended: 'Recommended', share: 'To share', vegetarian: 'Vegetarian', spicy: 'Spicy' }
  };

  function applyStaticCopy() {
    app.querySelectorAll('[data-copy]').forEach((element) => {
      element.textContent = t()[element.dataset.copy] || '';
    });
    const languageButton = app.querySelector('[data-action="toggle-language"]');
    languageButton.textContent = state.lang === 'es' ? 'EN' : 'ES';
    languageButton.setAttribute('aria-label', state.lang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish');
    region('search-label').textContent = ft().searchLabel;
    region('filter-label').textContent = ft().filterLabel;
  }

  function renderSearchControls() {
    const input = app.querySelector('[data-field="menu-search"]');
    if (input.value !== state.query) input.value = state.query;
    input.placeholder = ft().searchPlaceholder;
    const clearButton = region('clear-search');
    clearButton.hidden = !state.query;
    clearButton.setAttribute('aria-label', ft().clearSearch);
    region('filters').setAttribute('aria-label', ft().filterLabel);
  }

  function renderFilters() {
    const filters = ['all', 'recommended', 'share', 'vegetarian', 'spicy'];
    region('filters').innerHTML = filters.map((filter) => `
      <button type="button" data-action="select-filter" data-filter="${filter}" aria-pressed="${state.filter === filter}" aria-controls="bocc-menu-products">${escapeHtml(ft()[filter])}</button>`).join('');
  }

  function renderFoodFilter() {
    const activeCategory = state.foodCategory && state.foodCategory !== 'all-food' ? categoryById(state.foodCategory) : null;
    const activeLabel = state.foodCategory === 'all-food'
      ? ft().allFoods
      : activeCategory
        ? categoryName(activeCategory)
        : ft().foodFilter;
    region('food-filter').innerHTML = `
      <details class="bocc-food-filter">
        <summary aria-controls="bocc-food-filter-options" aria-label="${escapeHtml(state.foodCategory ? `${ft().foodFilter}: ${activeLabel}` : ft().foodFilter)}">
          <span>${escapeHtml(activeLabel)}</span>
          <svg class="bocc-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m7 9 5 5 5-5"></path></svg>
        </summary>
        <div class="bocc-food-filter__menu" id="bocc-food-filter-options" role="group" aria-label="${escapeHtml(ft().foodFilter)}">
          <button type="button" data-action="select-food-category" data-food-category="all-food" aria-pressed="${state.foodCategory === 'all-food'}">${escapeHtml(ft().allFoods)}</button>
          ${foodCategoryIds.map((categoryId) => {
            const category = categoryById(categoryId);
            return `<button type="button" data-action="select-food-category" data-food-category="${categoryId}" aria-pressed="${state.foodCategory === categoryId}">${escapeHtml(categoryName(category))}</button>`;
          }).join('')}
          ${state.foodCategory ? `<button type="button" class="bocc-food-filter__reset" data-action="clear-food-filter">${escapeHtml(ft().clearFoodFilter)}</button>` : ''}
        </div>
      </details>`;
  }

  function renderCategories() {
    region('categories').innerHTML = categories.map((category) => `
      <button type="button" data-action="select-category" data-category="${category.id}" aria-pressed="${!isDiscovering() && state.category === category.id}">${escapeHtml(categoryName(category))}</button>`).join('');
  }

  function renderProducts() {
    const category = categoryById(state.category);
    const query = normalizeSearch(state.query);
    const source = state.foodCategory === 'all-food'
      ? products.filter((product) => foodCategoryIds.includes(product.category))
      : state.foodCategory
        ? products.filter((product) => product.category === state.foodCategory)
        : isDiscovering()
          ? products
          : products.filter((product) => product.category === state.category);
    const visible = source.filter((product) => {
      const matchesFilter = state.filter === 'all' || product.tags.includes(state.filter);
      const productCategory = categoryById(product.category);
      const searchable = normalizeSearch([
        product.nameEs,
        product.nameEn,
        product.descEs,
        product.descEn,
        productCategory?.es,
        productCategory?.en,
        ...product.tags.map((tag) => `${tagLabels.es[tag] || ''} ${tagLabels.en[tag] || ''}`)
      ].join(' '));
      return matchesFilter && (!query || searchable.includes(query));
    });

    if (isDiscovering()) {
      const selectedFoodCategory = state.foodCategory && state.foodCategory !== 'all-food' ? categoryById(state.foodCategory) : null;
      region('category-title').textContent = state.query.trim()
        ? ft().resultsTitle
        : state.foodCategory === 'all-food'
          ? ft().allFoods
          : selectedFoodCategory
            ? categoryName(selectedFoodCategory)
            : ft()[state.filter];
      region('category-description').textContent = state.query.trim()
        ? ft().resultsDescription
        : selectedFoodCategory
          ? categoryDescription(selectedFoodCategory)
          : state.foodCategory === 'all-food'
            ? ft().foodFilterDescription
            : ft().filteredDescription;
    } else {
      region('category-title').textContent = categoryName(category);
      region('category-description').textContent = categoryDescription(category);
    }
    region('category-count').textContent = formatItemCount(visible.length);

    if (!visible.length) {
      if (isDiscovering()) {
        region('products').innerHTML = `
          <div class="bocc-empty-state">
            ${icon('search')}
            <h4>${escapeHtml(ft().noResults)}</h4>
            <p>${escapeHtml(ft().noResultsHelp)}</p>
            <button type="button" class="bocc-text-button" data-action="reset-discovery">${escapeHtml(ft().clearFilters)} ${icon('arrow')}</button>
          </div>`;
        return;
      }
      region('products').innerHTML = `
        <div class="bocc-empty-state">
          ${icon('bell')}
          <h4>${escapeHtml(t().noItems)}</h4>
          <p>${escapeHtml(t().noItemsHelp)}</p>
          <button type="button" class="bocc-text-button" data-action="open-help">${escapeHtml(t().callWaiter)} ${icon('arrow')}</button>
        </div>`;
      return;
    }

    region('products').innerHTML = visible.map((product, index) => {
      const unavailable = product.price === null;
      const disabled = product.soldOut;
      const customizable = Boolean(customizationType(product));
      const action = unavailable ? 'ask-product' : customizable ? 'open-product' : 'add-product';
      const actionLabel = disabled ? t().soldOut : unavailable ? t().unavailable : customizable ? et().customize : t().add;
      const tags = product.tags.map((tag) => tagLabels[state.lang][tag]);
      if (customizable) tags.push(et().customizable);
      return `
        <article class="bocc-product-card${disabled ? ' is-sold-out' : ''}">
          <button class="bocc-product-card__image" type="button" data-action="open-product" data-product="${product.id}" aria-label="${escapeHtml(`${t().details}: ${productName(product)}`)}">
            <img src="${product.image}" alt="${escapeHtml(productName(product))}" width="560" height="420" loading="lazy">
            <span>${String(index + 1).padStart(2, '0')}</span>
          </button>
          <div class="bocc-product-card__body">
            ${isDiscovering() ? `<span class="bocc-product-card__category">${escapeHtml(categoryName(categoryById(product.category)))}</span>` : ''}
            <div class="bocc-product-card__title-row"><h4>${escapeHtml(productName(product))}</h4><strong>${escapeHtml(formatPrice(product.price))}</strong></div>
            <p>${escapeHtml(productDescription(product))}</p>
            ${tags.length ? `<div class="bocc-product-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            <div class="bocc-product-card__actions">
              <button class="bocc-add-button" type="button" data-action="${action}" data-product="${product.id}" ${disabled ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>
              <button class="bocc-text-button" type="button" data-action="open-product" data-product="${product.id}">${escapeHtml(t().details)}</button>
            </div>
            <button class="bocc-product-card__ask" type="button" data-action="ask-product" data-product="${product.id}">${escapeHtml(t().ask)}</button>
          </div>
        </article>`;
    }).join('');
  }

  function cartItems() {
    return [...state.cart.entries()].map(([lineId, item]) => {
      const product = productById(item.productId);
      const allowedExtras = extraOptionsForProduct(product);
      return {
        lineId,
        product,
        extras: item.extraIds.map((extraId) => allowedExtras.find((extra) => extra.id === extraId)).filter(Boolean),
        ...item
      };
    });
  }

  function cartSummary() {
    return cartItems().reduce((summary, item) => ({
      count: summary.count + item.quantity,
      total: summary.total + lineTotal(item),
      hasPendingExtraPrice: summary.hasPendingExtraPrice || item.extras.some((extra) => extra.price === null)
    }), { count: 0, total: 0, hasPendingExtraPrice: false });
  }

  function lineTotal(item) {
    const extrasTotal = item.extras.reduce((total, extra) => total + (extra.price ?? 0), 0);
    return (item.product.price + extrasTotal) * item.quantity;
  }

  function renderCartBar() {
    const summary = cartSummary();
    const bar = region('cart-bar');
    bar.hidden = summary.count === 0;
    region('cart-count').textContent = state.lang === 'es' ? `${summary.count} ${summary.count === 1 ? 'producto' : 'productos'}` : `${summary.count} ${summary.count === 1 ? 'item' : 'items'}`;
    region('cart-total').textContent = `${t().estimated}: ${formatPrice(summary.total)}`;
    region('live').textContent = state.lang === 'es'
      ? `${summary.count} ${summary.count === 1 ? 'producto' : 'productos'} en el pedido`
      : `${summary.count} ${summary.count === 1 ? 'item' : 'items'} in the order`;
  }

  function renderOrderProgress() {
    const progress = region('order-progress');
    if (!state.order) {
      progress.hidden = true;
      progress.innerHTML = '';
      return;
    }
    const steps = ['sent', 'accepted', 'preparing', 'ready', 'delivered'];
    const labels = [t().orderSent, t().accepted, t().preparing, t().ready, t().delivered];
    const current = steps.indexOf(state.order.status);
    progress.hidden = false;
    progress.innerHTML = `
      <div class="bocc-order-progress__head"><div><span>${state.lang === 'es' ? 'Pedido' : 'Order'} ${state.order.number}</span><strong>${labels[current]}</strong></div><span>${t().table}</span></div>
      <ol>${steps.map((step, index) => `<li class="${index <= current ? 'is-complete' : ''}" aria-current="${index === current ? 'step' : 'false'}"><span></span><small>${labels[index]}</small></li>`).join('')}</ol>`;
  }

  function renderAll() {
    applyStaticCopy();
    renderSearchControls();
    renderFilters();
    renderFoodFilter();
    renderCategories();
    renderProducts();
    renderCartBar();
    renderOrderProgress();
  }

  function announce(message) {
    const toast = region('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(announce.timeout);
    announce.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 3800);
  }

  function openDialog(name) {
    const target = dialog(name);
    if (!target.open) target.showModal();
    target.querySelector('button, input, textarea, select')?.focus();
  }

  function closeDialog(target) {
    const openTarget = target?.closest?.('dialog') || target;
    if (openTarget?.open) openTarget.close();
  }

  function addProduct(id, quantity = 1, note = '', extraIds = []) {
    const product = productById(id);
    if (!product || product.price === null || product.soldOut) return;
    const allowedIds = new Set(extraOptionsForProduct(product).map((extra) => extra.id));
    const normalizedExtraIds = [...new Set(extraIds)].filter((extraId) => allowedIds.has(extraId)).sort();
    const normalizedNote = note.trim();
    const configurationKey = JSON.stringify([id, normalizedExtraIds, normalizeSearch(normalizedNote)]);
    const existing = [...state.cart.entries()].find(([, item]) => item.configurationKey === configurationKey);
    if (existing) {
      const [lineId, current] = existing;
      state.cart.set(lineId, { ...current, quantity: current.quantity + quantity });
    } else {
      const lineId = `L-${String(state.nextLineNumber).padStart(3, '0')}`;
      state.nextLineNumber += 1;
      state.cart.set(lineId, { productId: id, quantity, note: normalizedNote, extraIds: normalizedExtraIds, configurationKey });
    }
    renderCartBar();
    const extraMessage = normalizedExtraIds.length
      ? state.lang === 'es' ? ` con ${normalizedExtraIds.length} ${normalizedExtraIds.length === 1 ? 'extra' : 'extras'}` : ` with ${normalizedExtraIds.length} ${normalizedExtraIds.length === 1 ? 'extra' : 'extras'}`
      : '';
    announce(state.lang === 'es' ? `Se agregó ${productName(product)}${extraMessage} al pedido.` : `${productName(product)} added${extraMessage} to your order.`);
  }

  function updateExtraSummary() {
    const target = dialog('product');
    const checked = [...target.querySelectorAll('[data-field="product-extra"]:checked')];
    const availableExtras = extraOptionsForProduct(productById(state.selectedProduct));
    const count = target.querySelector('[data-region="extra-count"]');
    const names = target.querySelector('[data-region="extra-names"]');
    if (!count || !names) return;
    count.textContent = checked.length === 0 ? et().noneSelected : checked.length === 1 ? et().selectedSingular : `${checked.length} ${et().selectedPlural}`;
    names.textContent = checked.map((input) => {
      const extra = availableExtras.find((item) => item.id === input.value);
      return extra ? `${extraName(extra)} ${formatExtraPrice(extra.price)}` : input.dataset.extraName;
    }).join(' · ');
  }

  function renderProductDialog(id) {
    const product = productById(id);
    state.selectedProduct = id;
    const canAdd = product.price !== null && !product.soldOut;
    const type = customizationType(product);
    const extras = extraOptionsForProduct(product);
    dialog('product').innerHTML = `
      <div class="bocc-dialog__panel bocc-product-sheet">
        <button class="bocc-dialog__close" type="button" data-action="close-dialog" aria-label="${state.lang === 'es' ? 'Cerrar' : 'Close'}">${icon('close')}</button>
        <img src="${product.image}" alt="${escapeHtml(productName(product))}" width="900" height="680">
        <div class="bocc-product-sheet__content">
          <p>${escapeHtml(categoryName(categoryById(product.category)))}</p>
          <div class="bocc-product-sheet__title"><h3>${escapeHtml(productName(product))}</h3><strong>${escapeHtml(formatPrice(product.price))}</strong></div>
          <p class="bocc-product-sheet__description">${escapeHtml(productDescription(product))}</p>
          ${canAdd ? `
            <div class="bocc-product-sheet__controls">
              ${type ? `<fieldset class="bocc-extra-builder">
                <legend>${escapeHtml(type === 'pizza' ? et().pizzaTitle : et().burgerTitle)}</legend>
                <p>${escapeHtml(et().instruction)}</p>
                <div class="bocc-extra-builder__options">
                  ${extras.map((extra) => `<label class="bocc-extra-option">
                    <input type="checkbox" value="${extra.id}" data-field="product-extra" data-extra-name="${escapeHtml(extraName(extra))}">
                    <span class="bocc-extra-option__check">${icon('check')}</span>
                    <span class="bocc-extra-option__name">${escapeHtml(extraName(extra))}</span>
                    <strong>${escapeHtml(formatExtraPrice(extra.price))}</strong>
                  </label>`).join('')}
                </div>
                <div class="bocc-extra-summary" aria-live="polite" aria-atomic="true"><strong data-region="extra-count">${escapeHtml(et().noneSelected)}</strong><span data-region="extra-names"></span></div>
                <small>${escapeHtml(et().demoNotice)}</small>
              </fieldset>` : ''}
              <label>${state.lang === 'es' ? 'Cantidad' : 'Quantity'}<input type="number" min="1" max="12" value="1" data-field="product-quantity"></label>
              <label>${escapeHtml(et().preparationNote)} <span>${state.lang === 'es' ? '(opcional)' : '(optional)'}</span><textarea rows="3" data-field="product-note" placeholder="${escapeHtml(et().notePlaceholder)}"></textarea></label>
            </div>
            <button class="bocc-primary-button" type="button" data-action="add-from-dialog" data-product="${product.id}">${escapeHtml(type ? et().addConfigured : (state.lang === 'es' ? 'Agregar al pedido' : 'Add to order'))} ${icon('bag')}</button>` : `
            <div class="bocc-product-sheet__notice">${escapeHtml(product.soldOut ? t().soldOut : (state.lang === 'es' ? 'Precio no indicado en la carta actual.' : 'Price is not listed in the current menu.'))}</div>
            <button class="bocc-primary-button" type="button" data-action="ask-product" data-product="${product.id}">${escapeHtml(t().ask)} ${icon('arrow')}</button>`}
        </div>
      </div>`;
  }

  function renderCartDialog() {
    const items = cartItems();
    const summary = cartSummary();
    dialog('cart').innerHTML = `
      <div class="bocc-dialog__panel bocc-cart-sheet">
        <header><div><p>${t().table}</p><h3>${state.lang === 'es' ? 'Tu pedido' : 'Your order'}</h3></div><button class="bocc-dialog__close" type="button" data-action="close-dialog" aria-label="${state.lang === 'es' ? 'Cerrar' : 'Close'}">${icon('close')}</button></header>
        <div class="bocc-cart-sheet__items">
          ${items.length ? items.map(({ lineId, product, quantity, note, extras }) => `
            <article class="bocc-cart-item">
              <img src="${product.image}" alt="" width="112" height="112">
              <div class="bocc-cart-item__copy"><h4>${escapeHtml(productName(product))}</h4><span>${formatPrice(lineTotal({ product, quantity, extras }))}</span>
                ${extras.length ? `<div class="bocc-line-extras"><strong>${escapeHtml(et().itemExtras)}</strong><ul>${extras.map((extra) => `<li>${escapeHtml(extraName(extra))} <b>${escapeHtml(formatExtraPrice(extra.price))}</b></li>`).join('')}</ul></div>` : ''}
                ${note ? `<p><strong>${escapeHtml(et().preparationNote)}:</strong> ${escapeHtml(note)}</p>` : ''}
              </div>
              <div class="bocc-quantity" aria-label="${escapeHtml(`${state.lang === 'es' ? 'Cantidad' : 'Quantity'}: ${productName(product)}`)}">
                <button type="button" data-action="decrease" data-line="${lineId}" aria-label="${state.lang === 'es' ? 'Reducir cantidad' : 'Decrease quantity'}">${icon('minus')}</button>
                <span>${quantity}</span>
                <button type="button" data-action="increase" data-line="${lineId}" aria-label="${state.lang === 'es' ? 'Aumentar cantidad' : 'Increase quantity'}">${icon('plus')}</button>
              </div>
              <button class="bocc-cart-item__remove" type="button" data-action="remove" data-line="${lineId}">${state.lang === 'es' ? 'Eliminar' : 'Remove'}</button>
            </article>`).join('') : `<div class="bocc-empty-state"><h4>${state.lang === 'es' ? 'Tu pedido está vacío.' : 'Your order is empty.'}</h4><p>${state.lang === 'es' ? 'Agrega un plato para comenzar.' : 'Add a dish to get started.'}</p></div>`}
        </div>
        ${items.length ? `
          <label class="bocc-cart-note">${state.lang === 'es' ? 'Instrucciones para el pedido' : 'Order instructions'}<textarea rows="3" data-field="cart-note" placeholder="${state.lang === 'es' ? 'Ej. servir bebidas primero' : 'E.g. serve drinks first'}">${escapeHtml(state.cartNote)}</textarea></label>
          <div class="bocc-cart-sheet__total"><span>${t().estimated}</span><strong>${formatPrice(summary.total)}</strong></div>
          ${summary.hasPendingExtraPrice ? `<p class="bocc-cart-sheet__price-notice">${escapeHtml(et().priceNotice)}</p>` : ''}
          <div class="bocc-cart-error" data-region="send-error" ${state.failedSend ? '' : 'hidden'} role="alert"><strong>${state.lang === 'es' ? 'No se pudo enviar la demostración.' : 'The demo order could not be sent.'}</strong><span>${state.lang === 'es' ? 'El pedido se conserva. Reintenta cuando quieras.' : 'Your order is safe. Try again whenever you are ready.'}</span></div>
          <button class="bocc-primary-button" type="button" data-action="send-order">${state.lang === 'es' ? 'Enviar pedido' : 'Send order'} ${icon('arrow')}</button>
          <button class="bocc-simulate-button" type="button" data-action="simulate-error">${state.lang === 'es' ? 'Ver estado de error simulado' : 'Preview simulated error state'}</button>` : ''}
      </div>`;
  }

  function renderHelpDialog(productId = null, mode = 'menu') {
    state.selectedHelpProduct = productId;
    const selected = productId || products.find((product) => product.price !== null)?.id;
    const askMode = mode === 'ask';
    const otherMode = mode === 'other';
    dialog('help').innerHTML = `
      <div class="bocc-dialog__panel bocc-help-sheet">
        <header><div><p>${t().table}</p><h3>${state.lang === 'es' ? '¿Cómo podemos ayudarte?' : 'How can we help?'}</h3></div><button class="bocc-dialog__close" type="button" data-action="close-dialog" aria-label="${state.lang === 'es' ? 'Cerrar' : 'Close'}">${icon('close')}</button></header>
        ${!askMode && !otherMode ? `<div class="bocc-help-options">
          <button type="button" data-action="send-help" data-help="waiter">${icon('bell')}<span>${state.lang === 'es' ? 'Llamar al mesero' : 'Call waiter'}</span></button>
          <button type="button" data-action="help-form" data-help="ask">${icon('bag')}<span>${state.lang === 'es' ? 'Preguntar por un plato' : 'Ask about a dish'}</span></button>
          <button type="button" data-action="send-help" data-help="water"><span aria-hidden="true">H₂O</span><span>${state.lang === 'es' ? 'Solicitar agua' : 'Request water'}</span></button>
          <button type="button" data-action="send-help" data-help="cutlery"><span aria-hidden="true">///</span><span>${state.lang === 'es' ? 'Solicitar cubiertos' : 'Request cutlery'}</span></button>
          <button type="button" data-action="send-help" data-help="bill"><span aria-hidden="true">₡</span><span>${state.lang === 'es' ? 'Pedir la cuenta' : 'Ask for the bill'}</span></button>
          <button type="button" data-action="help-form" data-help="other"><span aria-hidden="true">···</span><span>${state.lang === 'es' ? 'Otra solicitud' : 'Another request'}</span></button>
        </div>` : `
          <form class="bocc-help-form" data-help-mode="${askMode ? 'ask' : 'other'}">
            ${askMode ? `<label>${state.lang === 'es' ? 'Plato' : 'Dish'}<select data-field="help-product">${products.filter((product) => product.category !== 'bebidas').map((product) => `<option value="${product.id}" ${product.id === selected ? 'selected' : ''}>${escapeHtml(productName(product))}</option>`).join('')}</select></label>` : ''}
            <label>${state.lang === 'es' ? '¿Qué necesitas?' : 'What do you need?'}<textarea rows="4" data-field="help-note" required placeholder="${state.lang === 'es' ? 'Escribe tu consulta' : 'Write your request'}"></textarea></label>
            <button class="bocc-primary-button" type="button" data-action="submit-help">${state.lang === 'es' ? 'Enviar solicitud' : 'Send request'} ${icon('arrow')}</button>
            <button class="bocc-text-button" type="button" data-action="help-back">${state.lang === 'es' ? 'Volver' : 'Back'}</button>
          </form>`}
      </div>`;
  }

  const helpLabels = {
    es: { waiter: 'Mesero solicitado', water: 'Agua solicitada', cutlery: 'Cubiertos solicitados', bill: 'Cuenta solicitada', ask: 'Pregunta sobre un plato', other: 'Solicitud adicional' },
    en: { waiter: 'Waiter requested', water: 'Water requested', cutlery: 'Cutlery requested', bill: 'Bill requested', ask: 'Question about a dish', other: 'Additional request' }
  };

  function submitHelp(type, note = '', productId = null) {
    const product = productId ? productById(productId) : null;
    const request = { id: `R-${String(state.requests.length + 1).padStart(2, '0')}`, type, label: helpLabels[state.lang][type], note, productName: product ? productName(product) : '', time: state.lang === 'es' ? 'Ahora' : 'Now' };
    state.requests.unshift(request);
    closeDialog(dialog('help'));
    announce(state.lang === 'es' ? 'Solicitud enviada · Mesa 12. Un miembro del equipo fue notificado.' : 'Request sent · Table 12. A team member was notified.');
  }

  function renderWaiterDialog() {
    const order = state.order;
    const statusLabels = { sent: t().orderSent, accepted: t().accepted, preparing: t().preparing, ready: t().ready, delivered: t().delivered };
    dialog('waiter').innerHTML = `
      <div class="bocc-dialog__panel bocc-waiter-panel">
        <header class="bocc-waiter-panel__header"><div><p>${state.lang === 'es' ? 'Central de servicio · Demostración' : 'Service hub · Demonstration'}</p><h3>${state.lang === 'es' ? 'Sala Boccantina' : 'Boccantina floor'}</h3></div><button class="bocc-dialog__close" type="button" data-action="close-dialog" aria-label="${state.lang === 'es' ? 'Cerrar' : 'Close'}">${icon('close')}</button></header>
        <div class="bocc-waiter-stats"><div><strong>1</strong><span>${state.lang === 'es' ? 'mesa activa' : 'active table'}</span></div><div><strong>${order ? 1 : 0}</strong><span>${state.lang === 'es' ? 'pedido' : 'order'}</span></div><div><strong>${state.requests.length}</strong><span>${state.lang === 'es' ? 'solicitudes' : 'requests'}</span></div></div>
        <div class="bocc-waiter-columns">
          <section><div class="bocc-waiter-column__head"><h4>${state.lang === 'es' ? 'Pedidos' : 'Orders'}</h4><span>${order ? 1 : 0}</span></div>
            ${order ? `<article class="bocc-waiter-order">
              <div class="bocc-waiter-order__head"><div><span>${t().table} · ${order.number}</span><strong>${statusLabels[order.status]}</strong></div><time>${state.lang === 'es' ? 'Ahora' : 'Now'}</time></div>
              <ul>${order.items.map((item) => `<li><span>${item.quantity} × ${escapeHtml(productName(item.product))}</span><strong>${formatPrice(lineTotal(item))}</strong>${item.extras.length ? `<small class="bocc-waiter-order__extras"><b>${escapeHtml(et().extrasLabel)}:</b> ${item.extras.map((extra) => `${escapeHtml(extraName(extra))} (${escapeHtml(formatExtraPrice(extra.price))})`).join(' · ')}</small>` : ''}${item.note ? `<small class="bocc-waiter-order__prep"><b>${escapeHtml(et().preparationNote)}:</b> ${escapeHtml(item.note)}</small>` : ''}</li>`).join('')}</ul>
              ${order.note ? `<p class="bocc-waiter-order__note"><strong>${state.lang === 'es' ? 'Nota' : 'Note'}:</strong> ${escapeHtml(order.note)}</p>` : ''}
              <div class="bocc-waiter-order__actions">${[
                ['accepted', state.lang === 'es' ? 'Aceptar' : 'Accept'],
                ['preparing', state.lang === 'es' ? 'Preparando' : 'Preparing'],
                ['ready', t().ready],
                ['delivered', t().delivered]
              ].map(([status, label]) => `<button type="button" data-action="set-status" data-status="${status}" aria-pressed="${order.status === status}">${label}</button>`).join('')}</div>
            </article>` : `<div class="bocc-waiter-empty"><span>${icon('bag')}</span><p>${state.lang === 'es' ? 'Los pedidos enviados aparecerán aquí.' : 'New orders will appear here.'}</p></div>`}
          </section>
          <section><div class="bocc-waiter-column__head"><h4>${state.lang === 'es' ? 'Atención de mesa' : 'Table service'}</h4><span>${state.requests.length}</span></div>
            ${state.requests.length ? `<div class="bocc-request-list">${state.requests.map((request) => `<article><div><span>${t().table}</span><time>${request.time}</time></div><strong>${escapeHtml(request.label)}</strong>${request.productName ? `<p>${escapeHtml(request.productName)}</p>` : ''}${request.note ? `<p>${escapeHtml(request.note)}</p>` : ''}<button type="button" data-action="resolve-request" data-request="${request.id}">${state.lang === 'es' ? 'Marcar atendida' : 'Mark resolved'}</button></article>`).join('')}</div>` : `<div class="bocc-waiter-empty"><span>${icon('bell')}</span><p>${state.lang === 'es' ? 'Sin solicitudes pendientes.' : 'No pending requests.'}</p></div>`}
          </section>
        </div>
      </div>`;
  }

  function sendOrder() {
    const items = cartItems();
    if (!items.length) return;
    state.cartNote = dialog('cart').querySelector('[data-field="cart-note"]')?.value.trim() || '';
    state.order = { number: '#A-012', status: 'sent', items, note: state.cartNote };
    state.cart.clear();
    state.failedSend = false;
    closeDialog(dialog('cart'));
    renderAll();
    announce(state.lang === 'es' ? 'Pedido #A-012 enviado a la central del mesero.' : 'Order #A-012 sent to the waiter hub.');
  }

  app.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const productId = button.dataset.product;

    if (action === 'toggle-language') {
      state.lang = state.lang === 'es' ? 'en' : 'es';
      document.documentElement.lang = state.lang;
      renderAll();
    } else if (action === 'select-category') {
      state.category = button.dataset.category;
      state.query = '';
      state.filter = 'all';
      state.foodCategory = null;
      renderSearchControls();
      renderFilters();
      renderFoodFilter();
      renderCategories();
      renderProducts();
      app.querySelector('.bocc-menu-app__section-heading').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } else if (action === 'select-filter') {
      state.filter = button.dataset.filter;
      renderFilters();
      renderCategories();
      renderProducts();
    } else if (action === 'select-food-category') {
      state.foodCategory = button.dataset.foodCategory;
      if (state.foodCategory !== 'all-food') state.category = state.foodCategory;
      button.closest('details')?.removeAttribute('open');
      renderFoodFilter();
      renderCategories();
      renderProducts();
      app.querySelector('.bocc-menu-app__section-heading').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } else if (action === 'clear-food-filter') {
      state.foodCategory = null;
      button.closest('details')?.removeAttribute('open');
      renderFoodFilter();
      renderCategories();
      renderProducts();
    } else if (action === 'clear-search') {
      state.query = '';
      renderSearchControls();
      renderCategories();
      renderProducts();
      app.querySelector('[data-field="menu-search"]').focus();
    } else if (action === 'reset-discovery') {
      state.query = '';
      state.filter = 'all';
      state.foodCategory = null;
      renderSearchControls();
      renderFilters();
      renderFoodFilter();
      renderCategories();
      renderProducts();
      app.querySelector('[data-field="menu-search"]').focus();
    } else if (action === 'add-product') {
      addProduct(productId);
    } else if (action === 'open-product') {
      renderProductDialog(productId);
      openDialog('product');
    } else if (action === 'add-from-dialog') {
      const target = dialog('product');
      const quantity = Math.max(1, Math.min(12, Number(target.querySelector('[data-field="product-quantity"]')?.value || 1)));
      const note = target.querySelector('[data-field="product-note"]')?.value.trim() || '';
      const extraIds = [...target.querySelectorAll('[data-field="product-extra"]:checked')].map((input) => input.value);
      addProduct(productId, quantity, note, extraIds);
      closeDialog(target);
    } else if (action === 'ask-product') {
      closeDialog(button.closest('dialog'));
      renderHelpDialog(productId, 'ask');
      openDialog('help');
    } else if (action === 'open-cart') {
      renderCartDialog();
      openDialog('cart');
    } else if (action === 'increase' || action === 'decrease') {
      const lineId = button.dataset.line;
      const current = state.cart.get(lineId);
      if (!current) return;
      current.quantity += action === 'increase' ? 1 : -1;
      if (current.quantity <= 0) state.cart.delete(lineId);
      else state.cart.set(lineId, current);
      renderCartBar();
      renderCartDialog();
    } else if (action === 'remove') {
      state.cart.delete(button.dataset.line);
      renderCartBar();
      renderCartDialog();
    } else if (action === 'simulate-error') {
      state.cartNote = dialog('cart').querySelector('[data-field="cart-note"]')?.value || '';
      state.failedSend = true;
      renderCartDialog();
      dialog('cart').querySelector('[data-region="send-error"]')?.focus?.();
    } else if (action === 'send-order') {
      sendOrder();
    } else if (action === 'open-help') {
      renderHelpDialog();
      openDialog('help');
    } else if (action === 'help-form') {
      renderHelpDialog(null, button.dataset.help);
    } else if (action === 'help-back') {
      renderHelpDialog();
    } else if (action === 'send-help') {
      submitHelp(button.dataset.help);
    } else if (action === 'submit-help') {
      const target = dialog('help');
      const form = target.querySelector('[data-help-mode]');
      const note = target.querySelector('[data-field="help-note"]')?.value.trim() || '';
      if (!note) {
        target.querySelector('[data-field="help-note"]')?.focus();
        return;
      }
      const type = form?.dataset.helpMode === 'ask' ? 'ask' : 'other';
      submitHelp(type, note, target.querySelector('[data-field="help-product"]')?.value || null);
    } else if (action === 'open-waiter') {
      renderWaiterDialog();
      openDialog('waiter');
    } else if (action === 'set-status') {
      if (!state.order) return;
      state.order.status = button.dataset.status;
      renderOrderProgress();
      renderWaiterDialog();
      announce(state.lang === 'es' ? `Pedido actualizado: ${button.textContent.trim()}.` : `Order updated: ${button.textContent.trim()}.`);
    } else if (action === 'resolve-request') {
      state.requests = state.requests.filter((request) => request.id !== button.dataset.request);
      renderWaiterDialog();
    } else if (action === 'close-dialog') {
      closeDialog(button);
    }
  });

  app.addEventListener('input', (event) => {
    if (event.target.matches('[data-field="cart-note"]')) state.cartNote = event.target.value;
    if (event.target.matches('[data-field="menu-search"]')) {
      state.query = event.target.value;
      renderSearchControls();
      renderCategories();
      renderProducts();
    }
  });

  app.addEventListener('change', (event) => {
    if (event.target.matches('[data-field="product-extra"]')) updateExtraSummary();
  });

  app.addEventListener('keydown', (event) => {
    const openFoodFilter = app.querySelector('.bocc-food-filter[open]');
    if (event.key === 'Escape' && openFoodFilter) {
      openFoodFilter.removeAttribute('open');
      openFoodFilter.querySelector('summary')?.focus();
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && event.target.matches('[data-field="menu-search"]') && state.query) {
      state.query = '';
      renderSearchControls();
      renderCategories();
      renderProducts();
    }
  });

  app.querySelectorAll('dialog').forEach((target) => {
    target.addEventListener('click', (event) => {
      if (event.target === target) closeDialog(target);
    });
  });

  window.addEventListener('storage', (event) => {
    if (!extraConfigApi || event.key !== extraConfigApi.storageKey) return;
    state.extraConfig = extraConfigApi.load();
    renderProducts();
    renderCartBar();
    if (dialog('cart').open) renderCartDialog();
  });

  renderAll();
})();
