"""End-to-end tests for StudyNest (Playwright, real browser).

Run:
    pip install pytest playwright && playwright install chromium
    pytest tests
"""
import json
from datetime import date, timedelta
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

PAGE = (Path(__file__).resolve().parent.parent / "index.html").as_uri()
DAY = lambda n: (date.today() + timedelta(days=n)).isoformat()


@pytest.fixture()
def page(tmp_path):
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1200, "height": 900}, accept_downloads=True)
        pg = context.new_page()
        pg.errors = []
        pg.on("pageerror", lambda e: pg.errors.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(PAGE)
        yield pg
        assert pg.errors == [], f"JavaScript errors: {pg.errors}"
        browser.close()


def save_dialog(pg):
    pg.click('dialog .btn:has-text("Save")')
    pg.wait_for_timeout(150)


def add_course(pg, name="Databases"):
    pg.click("text=Add my first course")
    pg.fill("dialog input[name=name]", name)
    save_dialog(pg)


def test_first_run_and_course_with_schedule(page):
    assert "Welcome to StudyNest" in page.inner_text("#view")
    add_course(page)
    page.click('.nav:has-text("Courses")')
    page.click(".course-card")
    page.click("text=➕ Add >> nth=0")
    page.select_option("dialog select[name=day]", "1")
    page.fill("dialog input[name=start]", "10:00")
    page.fill("dialog input[name=end]", "11:30")
    save_dialog(page)
    assert "Tuesday" in page.inner_text("#view")


def test_exam_progress_follows_topics_and_subtopics(page):
    add_course(page)
    page.click('.nav:has-text("Exams")')
    page.click("text=Add exam")
    page.fill("dialog input[name=date]", DAY(10))
    save_dialog(page)
    for topic in ["SQL basics", "Normalization"]:
        page.fill("form[data-form=topic-add] input", topic)
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
    for sub in ["SELECT", "JOIN"]:
        page.click("[data-act=sub-add] >> nth=0")
        page.fill("dialog input[name=v]", sub)
        save_dialog(page)
    # three leaves in total: SELECT, JOIN, Normalization
    page.locator("[data-chg=sub-toggle]").first.check()
    page.wait_for_timeout(150)
    assert "33%" in page.inner_text("#view")
    assert page.evaluate("document.querySelector('[data-chg=topic-toggle]').indeterminate")
    page.locator("[data-chg=topic-toggle]").first.check()
    page.wait_for_timeout(150)
    assert "67%" in page.inner_text("#view")
    page.locator("[data-chg=topic-toggle]").last.check()
    page.wait_for_timeout(150)
    assert "100%" in page.inner_text("#view")


def test_data_and_files_survive_a_reload(page, tmp_path):
    add_course(page)
    page.click('.nav:has-text("Exams")')
    page.click("text=Add exam")
    page.fill("dialog input[name=date]", DAY(5))
    save_dialog(page)
    page.fill("textarea[data-note=exam]", "Chapter 4 is important")
    note = tmp_path / "note.txt"
    note.write_text("hello notes")
    page.set_input_files("input[data-upload]", str(note))
    page.wait_for_timeout(400)
    with page.expect_download() as download:
        page.click("[data-act=file-dl]")
    assert Path(download.value.path()).read_text() == "hello notes"
    page.reload()
    page.click('.nav:has-text("Exams")')
    page.click(".card:has-text('Databases')")
    assert page.input_value("textarea[data-note=exam]") == "Chapter 4 is important"
    assert "note.txt" in page.inner_text("#view")


def test_task_lifecycle_and_reminders(page):
    add_course(page)
    page.click('.nav:has-text("Tasks")')
    page.click("text=Add task")
    page.fill("dialog input[name=title]", "Lab 1")
    page.fill("dialog input[name=due]", DAY(-1))
    save_dialog(page)
    assert "overdue" in page.inner_text("#view").lower()
    assert page.locator("[data-act=bell] .badge").inner_text() == "1"
    page.locator("[data-chg=task-toggle]").first.click()
    page.wait_for_timeout(150)
    assert "Lab 1" not in page.inner_text("#view")
    page.click("text=Done (1)")
    assert "Lab 1" in page.inner_text("#view")


def test_group_project_assignment_and_progress(page):
    page.click("text=Try with sample data")
    page.click('.nav:has-text("Projects")')
    page.click(".card:has-text('Mini shell')")
    assert "25%" in page.inner_text("#view")
    assert "1 task(s) not assigned yet" in page.inner_text("#view")
    page.click("[data-act=ptask-edit] >> nth=3")
    page.select_option("dialog select[name=assignee]", index=1)
    save_dialog(page)
    assert "not assigned" not in page.inner_text("#view")


def test_repeating_lists_reset_when_the_period_changes(page):
    page.click('.nav:has-text("Lists")')
    page.fill("form[data-kind=weekly] input", "Clean desk")
    page.keyboard.press("Enter")
    page.locator("[data-chg=li-toggle]").first.click()
    page.wait_for_timeout(150)
    assert "1/1" in page.inner_text("#view")
    state = page.evaluate("JSON.parse(localStorage.getItem('studynest.v1'))")
    state["lists"]["weekly"][0]["doneOn"] = "W2000-01-03"  # ticked in an old week
    page.evaluate("s => localStorage.setItem('studynest.v1', s)", json.dumps(state))
    page.reload()
    page.click('.nav:has-text("Lists")')
    assert "0/1" in page.inner_text("#view")


def test_backup_export_and_import_round_trip(page):
    add_course(page, "Algorithms")
    page.click("[data-act=settings]")
    with page.expect_download() as download:
        page.click("[data-act=export]")
    backup = Path(download.value.path())
    assert json.loads(backup.read_text())["courses"][0]["name"] == "Algorithms"
    page.click("[data-act=erase]")
    page.wait_for_timeout(200)
    page.click("[data-act=settings]")
    page.set_input_files("input[data-import]", str(backup))
    page.wait_for_timeout(300)
    page.click('.nav:has-text("Courses")')
    assert "Algorithms" in page.inner_text("#view")


def test_works_on_a_phone_without_horizontal_scroll(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.click("text=Try with sample data")
    for tab in ["Today", "Courses", "Exams", "Tasks", "Projects", "Lists"]:
        page.click(f'.nav:has-text("{tab}")')
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), tab


# ---------- Ask StudyNest (rule-based assistant) ----------
def ask(pg, question):
    if not pg.is_visible(".ask-form"):
        pg.click(".ask-fab")
    pg.fill(".ask-form input", question)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(100)
    return pg.inner_text(".ask-msgs .bot:last-child")


def test_assistant_answers_from_planner_data(page):
    page.click("text=Try with sample data")
    page.wait_for_timeout(200)
    assert "Quiz 2" in ask(page, "When is my next exam?")
    topics = ask(page, "What topics are in the Data Structures midterm?")
    assert "Arrays & linked lists" in topics and "Tree traversals" in topics and "44%" in topics
    assert "Homework 4" in ask(page, "Show my overdue tasks")
    assert "Pipes and redirection" in ask(page, "Which tasks are assigned to Mert?")
    assert "Determinants" in ask(page, "What should I study first?")


def test_assistant_understands_turkish_questions(page):
    page.click("text=Try with sample data")
    page.wait_for_timeout(200)
    assert "Quiz 2" in ask(page, "en yakın sınav ne zaman?")
    assert "Homework 4" in ask(page, "gecikmiş ödevlerim")
    assert "Mini shell project" in ask(page, "en yakın projem hangisi")


def test_assistant_handles_empty_planner_and_unknown_questions(page):
    assert "empty" in ask(page, "what is due this week").lower()
    page.click("text=Load sample data >> nth=0")
    page.wait_for_timeout(200)
    assert "did not understand" in ask(page, "blah blah")


def test_assistant_reflects_changes_immediately(page):
    page.click("text=Try with sample data")
    page.wait_for_timeout(200)
    assert "50%" in ask(page, "Quiz 2 progress")
    page.click(".ask-fab")  # close the panel to reach the page underneath
    page.click('.nav:has-text("Exams")')
    page.click("text=Quiz 2")
    page.click('.topic:has-text("Inverse") input[type=checkbox]')
    page.click('.topic:has-text("Determinants") input[type=checkbox]')
    assert "100%" in ask(page, "Quiz 2 progress")
