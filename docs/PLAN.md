# CivicTheme Update Helper

## Description
The CivicTheme Update Helper is designed to help developers update CivicTheme.

## Overview

The first round of checking functions the CivicTheme Update Helper has is:
- Configure the location of your sub-theme and CivicTheme directories
- Identify which version of CivicTheme you have installed
- Report on the fields of your website, and how many new, missing, customised (changed type or cardinality) fields exist in your site compared to a specific version of CivicTheme
- Identify new custom components in CivicTheme
- Identify overridden components

The second major feature is the visual regression tool. After we have done the above functions we will implement the ability to:

- Configure a website URL to snapshot
- Configure paths of a website to snapshot
- Configure viewports to snapshot
- Capture screenshots
- Configure masking for dyanmic elements

Then this set is saved and we can then take snapshots after upgrade and see the differences visually.
I have a system for this but it just needs to be notified.

All of this needs to be tied into a single application.



## Directory structure
index.mjs
`src/commands` - maps to commands in the application
`src/lib` - utilities for the application that can be shared
`projects` - in .gitignore but with `.gitkeep` saved to the directory
`civictheme` - data structures on civictheme fields, views, content types, vocabularies, vocabularies.

## CLI Setup

The CLI Application has been setup. We just need to populate the menu.

The following is proposed:

```
CivicTheme Update Helper"
version: 1.0

Start new project
Load existing project
```

When you click Start new project you then configure some application settings.
You are asked:

What is the name of the project?
What is the directory of CivicTheme?
What is the sub-theme directory?
What is the configuration directory for your site?

Projects are saved to sub-directories of `projects` - this is also where you load projects from.

The directory choices are an autocomplete of directories that help you navigate the file system

The name of the project is converted to directory and if the directory exists it says you need to choose a different name.

When you have selected these options, it converts the name of the project to a directory (via utility function) and saves configuration.json to the `projects/<project-name>` directory.


After saving a project, it will ask you to confirm that you want to 'Gather information about CivicTheme and Sub-Theme Installation'


## Gather information CivicTheme and Sub-Theme

If you confirm you want to do this the application will:

- Work out what version of CivicTheme it is
- Build a data structure of your site's config (this tool requires configuration to be exported)


The data structure includes the following:

- Content Types and their fields
- Vocabulary and their fields
- Media and their fields

Field data to record includes:
- Name
- ID
- type
- cardinality
- target_types (if entity reference)


## CivicTheme Helper development tools

We require a development tool to analyse CivicTheme versions. This is a development tool run by the developer
producing this application. It needs a separate entry point and maybe just a script to run

`npm run analyse-civictheme <tag>`

A git tag is analysed and it gets the tag mentioned here from:

https://git.drupalcode.org/project/civictheme/tree/<tag_number>

Downloads this version of the repository then gathers the following information.

We need to be able to specify a CivicTheme version, then download this via git clone
and get the following data and store it in:

- Content Types and their fields
- Vocabulary and their fields
- Media and their fields

Field data to record includes:
- Name
- ID
- type
- cardinality
- target_types (if entity reference)
- 
We also need to record data on components of each version of CivicTheme. We should record the following:

- namespace of component - directory path from `components`
- name of component - basename of twig file

This information is stored in `civictheme/<tag>/`

## Tools

`npm run test` - runs the tests
`npm run lint` - we are using eslint and want to maintain standards.

## Coding Standards

We need to work with commits and feature branches for each feature.
Every time before we do a commit we need to 

