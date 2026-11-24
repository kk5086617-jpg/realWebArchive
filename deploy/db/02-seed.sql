INSERT INTO applications (title, description, imageURL, sfwURL, developer, uploads, rate, releaseDate) VALUES 
('Cactus McCoy', 'Захватывающий платформер...', 'cactusmccoy_400x226.jpg', 'cactusmccoy/cactusmccoy.swf', 'Flipline Studios', 15400, 4.5, '2011-05-01'),
('Jacksmith', 'Главный герой, харизматичный осел...', 'jacksmith_400x226.jpg', 'jacksmith/jacksmith.swf', 'Flipline Studios', 12800, 4.8, '2012-09-24'),
('Midnight March', 'Атмосферная стратегия...', 'midnightmarch_400x226.jpg', 'midnightmarch/snjmidnightmarch.swf', 'Indie Dev', 3200, 3.9, '2015-10-31'),
('Papa''s Pastaria', 'Управляйте собственной паста-рестораном!...', 'papaspastaria_400x226.jpg', 'papaspastaria/papaspastaria.swf', 'Flipline Studios', 21000, 4.7, '2014-03-14'),
('Papa''s Pizzeria', 'С чего всё начиналось...', 'papaspizzeria_400x226.jpg', 'papaspizzeria/papaspizzeria_v2.swf', 'Flipline Studios', 45000, 4.9, '2007-08-15'),
('Papa''s Wingeria', 'Жарьте куриные крылышки...', 'papaswingeria_400x226.jpg', 'papaswingeria/papaswingeria.swf', 'Flipline Studios', 18500, 4.6, '2012-01-10'),
('Rock Garden', 'Расслабляющая казуальная игра...', 'rockgarden_400x226.jpg', 'rockgarden/rockgarden_v2.swf', 'Indie Dev', 800, 3.5, '2018-06-20');

-- Добавляем теги
INSERT INTO filters (name) VALUES ('Puzzle'), ('Action'), ('Simulation'), ('Platformer'), ('Strategy'), ('Arcade'), ('Management');

-- Привязываем теги к играм (по названиям)
INSERT INTO filter_app (appID, filterID) SELECT a.appID, f.filterID FROM applications a, filters f WHERE a.title = 'Jacksmith' AND f.name IN ('Action', 'Management');
INSERT INTO filter_app (appID, filterID) SELECT a.appID, f.filterID FROM applications a, filters f WHERE a.title = 'Cactus McCoy' AND f.name IN ('Platformer', 'Action');
INSERT INTO filter_app (appID, filterID) SELECT a.appID, f.filterID FROM applications a, filters f WHERE a.title LIKE 'Papa%' AND f.name = 'Management';
INSERT INTO filter_app (appID, filterID) SELECT a.appID, f.filterID FROM applications a, filters f WHERE a.title = 'Midnight March' AND f.name IN ('Strategy', 'Arcade');
INSERT INTO filter_app (appID, filterID) SELECT a.appID, f.filterID FROM applications a, filters f WHERE a.title = 'Rock Garden' AND f.name = 'Puzzle';