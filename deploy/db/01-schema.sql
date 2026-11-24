CREATE TABLE applications (
    appID SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    imageURL VARCHAR(255),
    sfwURL VARCHAR(255),
    developer VARCHAR(255),
    uploads INTEGER DEFAULT 0,
    rate NUMERIC DEFAULT 0,
    releaseDate TIMESTAMP
);
CREATE TABLE filters (
    filterID SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE filter_app (
    appID INTEGER NOT NULL REFERENCES applications(appID) ON DELETE CASCADE,
    filterID INTEGER NOT NULL REFERENCES filters(filterID) ON DELETE CASCADE,
    PRIMARY KEY (appID, filterID)
);
